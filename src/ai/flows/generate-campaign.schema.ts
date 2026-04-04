// src/ai/flows/generate-campaign.schema.ts
// Schemas for the multi-agent campaign generation pipeline.
import { z } from 'zod'

// ── Input ────────────────────────────────────────────────────────────────────

export const GenerateCampaignInputSchema = z
  .string()
  .min(20, 'Project description must be at least 20 characters')
  .max(1000, 'Project description must be under 1000 characters')

export type GenerateCampaignInput = z.infer<typeof GenerateCampaignInputSchema>

// ── Agent 1: Planner Output ──────────────────────────────────────────────────

export const CampaignPlanSchema = z.object({
  projectType: z
    .string()
    .describe(
      'The type of Web3 project (e.g., DeFi protocol, NFT collection, L2 chain, DAO, GameFi).',
    ),
  targetAudience: z
    .string()
    .describe(
      'Who this campaign should target (e.g., DeFi traders, NFT collectors, developers).',
    ),
  campaignGoal: z
    .string()
    .describe(
      'The primary goal of this campaign (e.g., grow community, drive TVL, increase mints).',
    ),
  recommendedPlatforms: z
    .array(z.string())
    .describe(
      'Which social platforms are most relevant for this project (e.g., Twitter, Discord, Telegram).',
    ),
  taskStrategy: z
    .array(
      z.object({
        taskType: z
          .enum([
            'SOCIAL_FOLLOW',
            'JOIN_DISCORD',
            'JOIN_TELEGRAM',
            'RETWEET',
            'ONCHAIN_TX',
            'HUMANITY_VERIFICATION',
          ])
          .describe('The recommended task type.'),
        rationale: z
          .string()
          .describe('Why this task type is relevant for this project.'),
      }),
    )
    .describe('2-4 recommended task types with reasoning.'),
  campaignTone: z
    .enum(['professional', 'casual', 'hype', 'educational'])
    .describe('The tone/voice for campaign copy.'),
})

export type CampaignPlan = z.infer<typeof CampaignPlanSchema>

// ── Agent 2: Generator Output (same shape as before — no UI breaking changes) ─

export const TaskTypeEnum = z.enum([
  'SOCIAL_FOLLOW',
  'JOIN_DISCORD',
  'JOIN_TELEGRAM',
  'RETWEET',
  'ONCHAIN_TX',
  'HUMANITY_VERIFICATION',
])

export const GenerateCampaignOutputSchema = z.object({
  title: z
    .string()
    .describe('A catchy and concise title for the campaign. Max 50 characters.'),
  shortDescription: z
    .string()
    .describe(
      'A brief, one-sentence description of the campaign for a preview card. Max 100 characters.',
    ),
  description: z
    .string()
    .describe(
      'A detailed, engaging description for the main campaign page. Min 50, max 500 characters.',
    ),
  tasks: z
    .array(
      z.object({
        type: TaskTypeEnum.describe('The type of task.'),
        description: z
          .string()
          .describe(
            'A clear, actionable description for the task. E.g., "Follow @ProjectName on X" or "Join our Discord server".',
          ),
      }),
    )
    .describe('A list of 2-4 relevant tasks for participants to complete.'),
})

export type GenerateCampaignOutput = z.infer<typeof GenerateCampaignOutputSchema>

// ── Agent 3: Validator Output ────────────────────────────────────────────────

export const ValidationResultSchema = z.object({
  approved: z
    .boolean()
    .describe('Whether the generated campaign passes all quality checks.'),
  overallScore: z
    .number()
    .min(1)
    .max(10)
    .describe('Overall quality score from 1-10.'),
  issues: z
    .array(
      z.object({
        field: z
          .string()
          .describe('Which field has an issue (title, description, tasks, etc.).'),
        severity: z
          .enum(['critical', 'warning', 'suggestion'])
          .describe('How severe the issue is.'),
        issue: z.string().describe('What the issue is.'),
        fix: z.string().describe('How to fix it.'),
      }),
    )
    .describe('List of issues found. Empty if approved.'),
  fixes: z
    .object({
      title: z.string().optional().describe('Fixed title, if title had issues.'),
      shortDescription: z
        .string()
        .optional()
        .describe('Fixed short description, if it had issues.'),
      description: z
        .string()
        .optional()
        .describe('Fixed description, if it had issues.'),
      tasks: z
        .array(
          z.object({
            type: TaskTypeEnum,
            description: z.string(),
          }),
        )
        .optional()
        .describe('Fixed tasks array, if tasks had issues.'),
    })
    .describe(
      'Direct fixes for issues. Only populated for fields that need correction.',
    ),
})

export type ValidationResult = z.infer<typeof ValidationResultSchema>
