'use server'
/**
 * @fileOverview Multi-agent pipeline for generating Web3 airdrop campaigns.
 *
 * Pipeline: Planner → Generator → Validator (with retry loop)
 *
 * - Planner: Analyzes the project and decides campaign strategy
 * - Generator: Creates campaign content based on the plan
 * - Validator: Checks quality, hallucinations, and consistency; can fix or retry
 */

import { generateObject } from 'ai'
import { model, MAX_VALIDATION_RETRIES } from '@/ai/config'
import {
  GenerateCampaignInputSchema,
  type GenerateCampaignInput,
  type GenerateCampaignOutput,
  type CampaignPlan,
  type ValidationResult,
  CampaignPlanSchema,
  GenerateCampaignOutputSchema,
  ValidationResultSchema,
} from './generate-campaign.schema'

// ── Error handling ───────────────────────────────────────────────────────────

export type GenerationStage = 'planning' | 'generating' | 'validating'
export type GenerationErrorCategory =
  | 'rate_limit'
  | 'api_error'
  | 'validation'
  | 'network'
  | 'config'
  | 'unknown'

/**
 * Structured metadata that can survive server-action serialization.
 * Encoded as a JSON prefix in the error message.
 */
export interface CampaignGenerationErrorData {
  stage: GenerationStage
  category: GenerationErrorCategory
  userMessage: string
  retryable: boolean
}

const ERROR_PREFIX = '[[CGE]]'

export class CampaignGenerationError extends Error {
  public readonly stage: GenerationStage
  public readonly category: GenerationErrorCategory
  public readonly userMessage: string
  public readonly retryable: boolean

  constructor(opts: {
    stage: GenerationStage
    category: GenerationErrorCategory
    userMessage: string
    retryable: boolean
    cause?: unknown
  }) {
    // Encode metadata into the message so it survives server-action serialization.
    // Next.js strips custom properties from server action errors, leaving only .message.
    const payload: CampaignGenerationErrorData = {
      stage: opts.stage,
      category: opts.category,
      userMessage: opts.userMessage,
      retryable: opts.retryable,
    }
    super(`${ERROR_PREFIX}${JSON.stringify(payload)}`)
    this.name = 'CampaignGenerationError'
    this.stage = opts.stage
    this.category = opts.category
    this.userMessage = opts.userMessage
    this.retryable = opts.retryable
    this.cause = opts.cause
  }
}

/**
 * Parse a CampaignGenerationError from a server-action error message.
 * Returns the structured data if present, or null if the error
 * is not a CampaignGenerationError.
 */
export function parseCampaignGenerationError(
  error: unknown,
): CampaignGenerationErrorData | null {
  const message = (error as any)?.message ?? String(error)
  if (!message.startsWith(ERROR_PREFIX)) return null
  try {
    return JSON.parse(message.slice(ERROR_PREFIX.length))
  } catch {
    return null
  }
}

/**
 * Inspect a raw error from the AI SDK and translate it into a
 * user-friendly CampaignGenerationError.
 */
function wrapAIError(
  raw: unknown,
  stage: GenerationStage,
): CampaignGenerationError {
  const err = raw as any
  const message: string = err?.message ?? String(raw)
  const statusCode: number | undefined =
    err?.statusCode ?? err?.lastError?.statusCode ?? err?.data?.error?.code

  // 1) Rate-limit / overloaded (429, 503)
  if (
    statusCode === 429 ||
    statusCode === 503 ||
    message.includes('high demand') ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('UNAVAILABLE') ||
    message.includes('overloaded') ||
    message.includes('Too Many Requests')
  ) {
    return new CampaignGenerationError({
      stage,
      category: 'rate_limit',
      userMessage:
        'The AI service is currently experiencing high demand. Please wait a minute and try again.',
      retryable: true,
      cause: raw,
    })
  }

  // 2) Auth / API key issues (401, 403)
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    message.includes('API key') ||
    message.includes('authentication') ||
    message.includes('permission') ||
    message.includes('PERMISSION_DENIED')
  ) {
    return new CampaignGenerationError({
      stage,
      category: 'config',
      userMessage:
        'AI service authentication failed. Please contact the site administrator.',
      retryable: false,
      cause: raw,
    })
  }

  // 3) Network errors
  if (
    message.includes('fetch failed') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('network') ||
    message.includes('ENOTFOUND') ||
    err?.code === 'UND_ERR_CONNECT_TIMEOUT'
  ) {
    return new CampaignGenerationError({
      stage,
      category: 'network',
      userMessage:
        'Could not connect to the AI service. Please check your internet connection and try again.',
      retryable: true,
      cause: raw,
    })
  }

  // 4) Zod / validation errors
  if (
    err?.name === 'ZodError' ||
    message.includes('validation') ||
    message.includes('ZodError')
  ) {
    return new CampaignGenerationError({
      stage,
      category: 'validation',
      userMessage:
        'The AI generated an invalid response. Please try again with a more detailed project description.',
      retryable: true,
      cause: raw,
    })
  }

  // 5) Generic server errors (500, 502, 504)
  if (statusCode && statusCode >= 500) {
    return new CampaignGenerationError({
      stage,
      category: 'api_error',
      userMessage:
        'The AI service encountered a server error. Please try again in a moment.',
      retryable: true,
      cause: raw,
    })
  }

  // 6) Unknown
  return new CampaignGenerationError({
    stage,
    category: 'unknown',
    userMessage:
      'Something went wrong while generating your campaign. Please try again.',
    retryable: true,
    cause: raw,
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateCampaign(
  input: GenerateCampaignInput,
): Promise<GenerateCampaignOutput> {
  // Validate input
  const trimmedInput = input.trim()
  try {
    GenerateCampaignInputSchema.parse(trimmedInput)
  } catch (zodErr: any) {
    throw new CampaignGenerationError({
      stage: 'planning',
      category: 'validation',
      userMessage:
        zodErr?.errors?.[0]?.message ??
        'Project description must be between 20 and 1000 characters.',
      retryable: false,
      cause: zodErr,
    })
  }

  // Step 1: Plan
  const plan = await runPlanner(trimmedInput)

  // Step 2: Generate
  let draft = await runGenerator(trimmedInput, plan)

  // Step 3: Validate (with retry loop)
  for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
    let validation: ValidationResult
    try {
      validation = await runValidator(trimmedInput, draft)
    } catch (valError) {
      // If validation fails on the last attempt, return the draft as-is
      // rather than failing the entire generation
      if (attempt === MAX_VALIDATION_RETRIES) {
        console.warn(
          'Campaign generation: validator failed on final attempt, returning unvalidated draft.',
          valError,
        )
        return sanitizeOutput(draft)
      }
      // Otherwise, skip validation and try regenerating
      console.warn(
        `Campaign generation: validator failed on attempt ${attempt + 1}, retrying...`,
        valError,
      )
      continue
    }

    if (validation.approved) {
      return applyFixes(draft, validation)
    }

    if (validation.fixes) {
      draft = applyFixes(draft, validation)
    }

    if (attempt === MAX_VALIDATION_RETRIES) {
      console.warn(
        'Campaign generation: max validation retries reached, returning best effort.',
        { issues: validation.issues },
      )
      return sanitizeOutput(draft)
    }

    const feedback = validation.issues
      .map((i) => `[${i.severity}] ${i.field}: ${i.issue} → ${i.fix}`)
      .join('\n')

    draft = await runGenerator(trimmedInput, plan, feedback)
  }

  return sanitizeOutput(draft)
}

// ── Agent 1: Planner ─────────────────────────────────────────────────────────

async function runPlanner(projectDescription: string): Promise<CampaignPlan> {
  try {
    const { object } = await generateObject({
      model,
      schema: CampaignPlanSchema,
      system: `You are a Web3 campaign strategist. Analyze the given project description and create a strategic plan for an airdrop campaign.

Your job is ONLY to analyze and plan — do NOT write the campaign content yet.

Consider:
- What type of Web3 project is this? (DeFi, NFT, L2, DAO, GameFi, etc.)
- Who is the target audience?
- What is the most effective campaign goal?
- Which social platforms are relevant for this project?
- What 2-4 task types would drive the most engagement for THIS specific project?
- What tone should the campaign copy use?

Be specific to the project described. Do not make generic recommendations.`,
      prompt: `Analyze this project and create a campaign strategy plan:

${projectDescription}`,
    })

    return object
  } catch (error) {
    throw wrapAIError(error, 'planning')
  }
}

// ── Agent 2: Generator ───────────────────────────────────────────────────────

async function runGenerator(
  projectDescription: string,
  plan: CampaignPlan,
  validatorFeedback?: string,
): Promise<GenerateCampaignOutput> {
  const feedbackSection = validatorFeedback
    ? `\n\nPREVIOUS ATTEMPT FEEDBACK (fix these issues):\n${validatorFeedback}`
    : ''

  try {
    const { object } = await generateObject({
      model,
      schema: GenerateCampaignOutputSchema,
      system: `You are an expert Web3 marketing copywriter. Generate campaign content based on the strategic plan provided.

STRICT RULES:
1. Use ONLY information from the project description — do NOT hallucinate details
2. DO NOT generate reward information (users add this separately)
3. Make tasks SPECIFIC to the project (not generic like "Complete social tasks")
4. Follow the strategic plan's recommendations for task types and tone
5. Character limits are enforced — be concise:
   - Title: max 50 characters
   - Short description: max 100 characters
   - Description: 50-500 characters
   - Task descriptions: max 200 characters each
6. Generate exactly 2-4 tasks based on the plan's task strategy

GOOD task examples:
- "Follow @ProjectName on X (Twitter)"
- "Join the ProjectName Discord community"
- "Stake tokens in the ProjectName protocol"
- "Mint your ProjectName genesis NFT"

BAD task examples (too generic — NEVER do this):
- "Complete social tasks"
- "Participate in the campaign"
- "Do stuff"`,
      prompt: `PROJECT DESCRIPTION:
${projectDescription}

STRATEGIC PLAN:
- Project Type: ${plan.projectType}
- Target Audience: ${plan.targetAudience}
- Campaign Goal: ${plan.campaignGoal}
- Recommended Platforms: ${plan.recommendedPlatforms.join(', ')}
- Tone: ${plan.campaignTone}
- Task Strategy:
${plan.taskStrategy.map((t) => `  - ${t.taskType}: ${t.rationale}`).join('\n')}
${feedbackSection}

Generate the campaign content now.`,
    })

    return object
  } catch (error) {
    throw wrapAIError(error, 'generating')
  }
}

// ── Agent 3: Validator ───────────────────────────────────────────────────────

async function runValidator(
  projectDescription: string,
  campaign: GenerateCampaignOutput,
): Promise<ValidationResult> {
  try {
    const { object } = await generateObject({
      model,
      schema: ValidationResultSchema,
      system: `You are a quality assurance agent for Web3 airdrop campaigns. Your job is to validate a generated campaign against the original project description.

CHECK FOR:
1. **Hallucination**: Does the campaign reference details NOT in the project description? (critical)
2. **Generic content**: Are tasks too generic like "Complete social tasks" instead of specific? (critical)
3. **Task relevance**: Do the tasks make sense for THIS specific project? (critical)
4. **Character limits**: Title ≤50, short description ≤100, description 50-500, task descriptions ≤200 (warning)
5. **Task count**: Should have 2-4 tasks (warning)
6. **Consistency**: Do the title, descriptions, and tasks tell a coherent story? (warning)
7. **Quality**: Is the copy engaging and professional? (suggestion)

SCORING:
- Score 8-10: Approve (minor suggestions OK)
- Score 5-7: Approve but apply fixes
- Score 1-4: Reject, provide fixes for critical issues

When you find issues, provide DIRECT FIXES in the "fixes" field — don't just describe the problem, provide the corrected content.

If the campaign is good (score ≥ 5), set approved=true even if you have suggestions.`,
      prompt: `ORIGINAL PROJECT DESCRIPTION:
${projectDescription}

GENERATED CAMPAIGN TO VALIDATE:
Title: ${campaign.title}
Short Description: ${campaign.shortDescription}
Description: ${campaign.description}
Tasks:
${campaign.tasks.map((t, i) => `  ${i + 1}. [${t.type}] ${t.description}`).join('\n')}

Validate this campaign. Check for hallucinations, generic content, and quality issues.`,
    })

    return object
  } catch (error) {
    throw wrapAIError(error, 'validating')
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function applyFixes(
  draft: GenerateCampaignOutput,
  validation: ValidationResult,
): GenerateCampaignOutput {
  const fixed = { ...draft }

  if (validation.fixes) {
    if (validation.fixes.title) fixed.title = validation.fixes.title
    if (validation.fixes.shortDescription)
      fixed.shortDescription = validation.fixes.shortDescription
    if (validation.fixes.description)
      fixed.description = validation.fixes.description
    if (validation.fixes.tasks && validation.fixes.tasks.length > 0)
      fixed.tasks = validation.fixes.tasks
  }

  return sanitizeOutput(fixed)
}

function sanitizeOutput(output: GenerateCampaignOutput): GenerateCampaignOutput {
  return {
    title: truncateText(output.title, 50),
    shortDescription: truncateText(output.shortDescription, 100),
    description:
      output.description.length > 500
        ? output.description.slice(0, 497) + '...'
        : output.description,
    tasks: output.tasks.slice(0, 4).map((task) => ({
      type: task.type,
      description: truncateText(task.description, 200),
    })),
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  const truncated = text.slice(0, maxLength - 3)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + '...'
  }

  return truncated + '...'
}
