'use server'
/**
 * @fileOverview Multi-agent pipeline for generating Web3 airdrop campaigns.
 *
 * Pipeline: Planner → Generator → Validator (with retry loop)
 *
 * - Planner: Analyzes the project and decides campaign strategy
 * - Generator: Creates campaign content based on the plan
 * - Validator: Checks quality, hallucinations, and consistency; can fix or retry
 *
 * Time-bounded (AI_CALL_TIMEOUT_MS per call, AI_PIPELINE_BUDGET_MS overall). Planner and
 * generator are REQUIRED — their failure is an error the user sees. Everything after the first
 * draft exists is BEST-EFFORT: a validator/regeneration failure, a timeout, or a spent budget
 * returns the best draft so far instead of an error or another round.
 */

import { generateObject } from 'ai'
import {
  AI_CALL_TIMEOUT_MS,
  AI_PIPELINE_BUDGET_MS,
  GEMINI_MODEL_ID,
  MAX_VALIDATION_RETRIES,
  model,
  thinkingOptions,
} from '@/ai/config'
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

import {
  type GenerationStage,
  type GenerationErrorCategory,
  CampaignGenerationError,
  wrapAIError,
} from './generate-campaign.errors'

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

  const started = Date.now()
  const deadline = started + AI_PIPELINE_BUDGET_MS
  const left = () => deadline - Date.now()
  const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`
  // One abort signal per call: never longer than the per-call cap, and for best-effort calls
  // never past the pipeline deadline either.
  const callSignal = (capMs = AI_CALL_TIMEOUT_MS) =>
    AbortSignal.timeout(Math.max(1_000, Math.min(AI_CALL_TIMEOUT_MS, capMs)))
  const log = (event: string) => console.info(`[ai/generate] ${event} at ${elapsed()} (${GEMINI_MODEL_ID})`)

  // ── Required: no draft without these, so their failures surface as errors.
  const plan = await runPlanner(trimmedInput, callSignal())
  log('plan ready')
  let draft = await runGenerator(trimmedInput, plan, undefined, callSignal())
  log('draft ready')

  // ── Best-effort from here: a draft exists, so nothing below may become an error.
  for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
    if (left() < MIN_VALIDATE_MS) {
      log('time budget spent; returning the draft unreviewed')
      return sanitizeOutput(draft)
    }

    let validation: ValidationResult
    try {
      validation = await runValidator(trimmedInput, draft, callSignal(left()))
    } catch (valError) {
      // Previously this `continue`d — which re-ran the validator on the SAME draft (the comment
      // claimed it regenerated), so a flaky or truncated validator response multiplied latency.
      console.warn(
        `[ai/generate] validator failed on attempt ${attempt + 1} at ${elapsed()}; returning the current draft.`,
        valError,
      )
      return sanitizeOutput(draft)
    }

    if (validation.approved) {
      log(`approved (score ${validation.overallScore})`)
      return applyFixes(draft, validation)
    }

    if (validation.fixes) {
      draft = applyFixes(draft, validation)
    }

    if (attempt === MAX_VALIDATION_RETRIES) {
      console.warn('[ai/generate] max validation rounds reached, returning best effort.', {
        issues: validation.issues,
      })
      return sanitizeOutput(draft)
    }

    if (left() < MIN_REGENERATE_MS) {
      log('not enough time left for another round; returning the fixed draft')
      return sanitizeOutput(draft)
    }

    const feedback = validation.issues
      .map((i) => `[${i.severity}] ${i.field}: ${i.issue} → ${i.fix}`)
      .join('\n')

    try {
      draft = await runGenerator(trimmedInput, plan, feedback, callSignal(left()))
      log(`regenerated (round ${attempt + 1})`)
    } catch (genError) {
      // `draft` still holds the previous (already fixed) version — return that.
      console.warn(`[ai/generate] regeneration failed at ${elapsed()}; returning the previous draft.`, genError)
      return sanitizeOutput(draft)
    }
  }

  return sanitizeOutput(draft)
}

// A best-effort round only starts if it can plausibly finish inside the budget.
const MIN_VALIDATE_MS = 8_000
const MIN_REGENERATE_MS = 15_000 // regenerate + the validation that follows it

// ── Agent 1: Planner ─────────────────────────────────────────────────────────

async function runPlanner(
  projectDescription: string,
  abortSignal: AbortSignal,
): Promise<CampaignPlan> {
  try {
    const { object } = await generateObject({
      model,
      schema: CampaignPlanSchema,
      abortSignal,
      maxRetries: 1, // one quick retry for a transient 503; the signal bounds both attempts
      maxOutputTokens: 4096,
      providerOptions: thinkingOptions('low'),
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
  validatorFeedback: string | undefined,
  abortSignal: AbortSignal,
): Promise<GenerateCampaignOutput> {
  const feedbackSection = validatorFeedback
    ? `\n\nPREVIOUS ATTEMPT FEEDBACK (fix these issues):\n${validatorFeedback}`
    : ''

  try {
    const { object } = await generateObject({
      model,
      schema: GenerateCampaignOutputSchema,
      abortSignal,
      maxRetries: 1,
      maxOutputTokens: 4096,
      providerOptions: thinkingOptions('low'),
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
  abortSignal: AbortSignal,
): Promise<ValidationResult> {
  try {
    const { object } = await generateObject({
      model,
      schema: ValidationResultSchema,
      abortSignal,
      // Best-effort: a failure returns the draft, so retrying only adds latency.
      maxRetries: 0,
      // Bounded so a long `fixes` payload can't run on until the JSON is cut off (the
      // production "could not parse the response" failure). Concision is asked for below.
      maxOutputTokens: 2048,
      providerOptions: thinkingOptions('low'),
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

If the campaign is good (score ≥ 5), set approved=true even if you have suggestions.

VAGUE INPUT: if the project description is brief or generic, generic-but-reasonable copy is
acceptable. Flag hallucination only when the campaign invents SPECIFIC facts that aren't in the
description (names, numbers, chains, partners, launch dates) — not for reasonable framing.

KEEP THE RESPONSE SHORT:
- At most 5 issues, one sentence each for "issue" and "fix".
- In "fixes", include ONLY the fields you are actually changing. Omit unchanged fields entirely;
  never repeat text that stays the same. If nothing needs changing, omit "fixes" altogether.`,
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
