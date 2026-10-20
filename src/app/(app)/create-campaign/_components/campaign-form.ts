import * as z from 'zod'
import { isAddress } from 'viem'
import { campaignDatesSchema } from '@/lib/campaign-timing'
import { isPositiveDecimalString, nftRowsFromStrings, nftRowsProblem, rankTierProblem, scoreTierProblem } from '@/lib/reward-plan'
import type { TaskType } from '@/lib/types'
import { claims } from '@/config/claims'

/**
 * The wizard's form model: the zod schema, its value type and the task-type list. Moved out of
 * page.tsx unchanged (a Next.js page can't export anything else), 08-site phase 2.
 */

// Ethereum address regex: 0x followed by 40 hex characters
export const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/** Stop waiting for "Generate with AI" after this long. Above the server's worst case (~70s
 * pipeline budget, src/ai/config.ts) so it only fires for a stuck or dropped request. */
export const CLIENT_GENERATION_GIVE_UP_MS = 90_000

/** Comma- or newline-separated list of numeric IDs -> trimmed, non-empty strings. */
export function parseIdList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}


export const taskSchema = z
  .object({
    type: z.enum([
      'SOCIAL_FOLLOW',
      'JOIN_DISCORD',
      'JOIN_TELEGRAM',
      'RETWEET',
      'ONCHAIN_TX',
      'HUMANITY_VERIFICATION',
    ]),
    description: z
      .string()
      .min(3, 'Task description must be at least 3 characters long.'),
    verificationData: z.string().optional(),
    // Optional = participants can skip it and still qualify for the reward (on-chain isOptional).
    isOptional: z.boolean().optional(),
    discordInviteLink: z.string().optional(),
    telegramInviteLink: z.string().optional(),
    // Humanity Protocol presets for HUMANITY_VERIFICATION tasks (multi-select)
    humanityPreset: z.array(z.string()).optional(),
    // Payment metadata fields for ONCHAIN_TX tasks
    paymentRequired: z.boolean().optional(),
    paymentRecipient: z.string().optional(),
    chainId: z.number().optional(),
    network: z.string().optional(),
    tokenAddress: z.string().optional(),
    tokenSymbol: z.string().optional(),
    amount: z.string().optional(), // Amount in ETH (will be converted to Wei)
    amountDisplay: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Validate payment fields when paymentRequired is true and task is ONCHAIN_TX
    if (data.type === 'ONCHAIN_TX' && data.paymentRequired) {
      // Validate paymentRecipient
      if (!data.paymentRecipient || data.paymentRecipient.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Payment recipient wallet address is required when payment is enabled.',
          path: ['paymentRecipient'],
        })
      } else if (!ETH_ADDRESS_REGEX.test(data.paymentRecipient)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Invalid Ethereum address. Must be 0x followed by 40 hexadecimal characters.',
          path: ['paymentRecipient'],
        })
      }

      // Validate amount
      if (!data.amount || data.amount.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Payment amount is required when payment is enabled.',
          path: ['amount'],
        })
      } else {
        const amountNum = parseFloat(data.amount)
        if (isNaN(amountNum) || amountNum <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Amount must be a valid positive number.',
            path: ['amount'],
          })
        }
      }
    }

    if (data.type === 'JOIN_DISCORD') {
      if (!data.verificationData || data.verificationData.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Discord Server ID is required.',
          path: ['verificationData'],
        })
      }
      if (!data.discordInviteLink || data.discordInviteLink.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Discord Invite Link is required.',
          path: ['discordInviteLink'],
        })
      }
    }

    if (data.type === 'JOIN_TELEGRAM') {
      if (!data.verificationData || data.verificationData.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Telegram Channel/Group ID is required.',
          path: ['verificationData'],
        })
      }
      if (!data.telegramInviteLink || data.telegramInviteLink.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Telegram Invite Link is required.',
          path: ['telegramInviteLink'],
        })
      }
    }
  })

/** The form's "no cover image" value: satisfies the URL rule, and renders as the empty dropzone. */
export const PLACEHOLDER_IMAGE_URL = 'https://placehold.co/600x400'

export function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

export const campaignSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  shortDescription: z
    .string()
    .min(10, 'Short description must be at least 10 characters long.'),
  description: z
    .string()
    .min(50, 'Detailed description must be at least 50 characters long.'),
  dates: campaignDatesSchema,
  imageUrl: z.string().url('Please enter a valid image URL.'),
  // Per-campaign sybil-gating toggle (docs/HUMANITY_GATING.md). No contract field — an
  // off-chain policy flag consumed by the allocation pipeline at tree-build time.
  humanityGated: z.boolean().default(false),
  maxParticipants: z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) <= 100_000),
      'Must be a whole number up to 100,000 (0 or blank = unlimited).',
    ),
  tasks: z.array(taskSchema).min(1, 'At least one task is required.'),
  reward: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('ERC20'),
      tokenAddress: z
        .string()
        .refine(
          (val) => isAddress(val),
          'Please enter a valid Ethereum address.',
        ),
      // .trim() changes the PARSED value, so submit's parseUnits never sees " 42 " (it throws on
      // whitespace — after createCampaign has already mined).
      amount: z
        .string()
        .trim()
        .min(1, 'Enter the total reward pool.')
        .refine(
          isPositiveDecimalString,
          'Enter an amount greater than 0 using digits and an optional decimal point, e.g. 1000 or 12.5.',
        ),
      name: z.string().optional(),
      // On-chain tiered settlement (P3 CP1, docs/REWARD_SYSTEM.md "ERC20 on-chain tiered
      // settlement"). MERKLE (default) is the existing P1 off-chain-computed flow, unchanged.
      settlementMode: z
        .enum(['MERKLE', 'RANK_TIERED', 'SCORE_TIERED'])
        .default('MERKLE'),
      rankTiers: z
        .array(
          z.object({
            startRank: z.coerce.number().int().min(1),
            endRank: z.coerce.number().int().min(1),
            amount: z.string().trim(),
          }),
        )
        .optional(),
      scoreTiers: z
        .array(
          z.object({
            minScore: z.coerce.number().int().min(0),
            amount: z.string().trim(),
          }),
        )
        .optional(),
      // Points awarded per task INDEX (aligned with the `tasks` array) toward SCORE_TIERED
      // scoring. Index i here corresponds to tasks[i]; a task not listed scores 0.
      taskPoints: z.array(z.coerce.number().int().min(0)).optional(),
    }),
    z.object({
      type: z.literal('ERC721'),
      tokenAddress: z
        .string()
        .refine(
          (val) => isAddress(val),
          'Please enter a valid Ethereum address.',
        ),
      name: z.string().optional(),
      // P3 CP2 — NFT settlement (Merkle, same allocation/dispute-window pattern as ERC20).
      // "ERC721" is kept as the discriminant literal for backwards form-state compatibility;
      // nftStandard picks the ACTUAL on-chain standard being deposited.
      nftStandard: z.enum(['ERC721', 'ERC1155']).default('ERC721'),
      // Comma/newline-separated token IDs to deposit.
      tokenIds: z.string().min(1, 'Enter at least one token ID.'),
      // ERC1155 only: comma/newline-separated amounts, same order/count as tokenIds.
      tokenAmounts: z.string().optional(),
    }),
    z.object({
      type: z.literal('None'),
      name: z.string().min(1, 'A description of the reward is required.'),
    }),
  ]),
}).superRefine((data, ctx) => {
  if (data.reward.type === 'ERC721') {
    const problem = nftRowsProblem(
      nftRowsFromStrings(data.reward.tokenIds, data.reward.tokenAmounts),
      data.reward.nftStandard,
    )
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: ['reward', 'tokenIds'] })
    return
  }
  if (data.reward.type !== 'ERC20') return
  // Mirrors OnChainRewardLib's tier validation. Tiers are configured AFTER createCampaign and
  // funding, so anything the contract would reject must be caught here, not on-chain.
  if (data.reward.settlementMode === 'RANK_TIERED') {
    const problem = rankTierProblem(data.reward.rankTiers || [])
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: ['reward', 'rankTiers'] })
  }
  if (data.reward.settlementMode === 'SCORE_TIERED') {
    const problem = scoreTierProblem(data.reward.scoreTiers || [])
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: ['reward', 'scoreTiers'] })
    const totalPoints = (data.reward.taskPoints || []).reduce((s, p) => s + (p || 0), 0)
    if (totalPoints === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assign at least one task a point value greater than 0 for score-tiered scoring.',
        path: ['reward', 'taskPoints'],
      })
    }
  }
})

export type CampaignFormValues = z.infer<typeof campaignSchema>

/**
 * The task types a host can pick, in menu order. Each one's verification chip comes from
 * TASK_VERIFICATION_METHOD (src/lib/task-types.ts) and is shown in the menu, so hosts see how a
 * task is checked before they pick it (app-design §1.10).
 */
export const TASK_TYPE_OPTIONS: { value: TaskType; label: string; checkLine?: string }[] = [
  { value: 'SOCIAL_FOLLOW', label: 'Follow an account on X' },
  { value: 'RETWEET', label: 'Repost a post on X' },
  { value: 'JOIN_DISCORD', label: 'Join a Discord server', checkLine: 'Our bot checks that the participant is a member of your server.' },
  { value: 'JOIN_TELEGRAM', label: 'Join a Telegram group or channel', checkLine: 'Our bot checks that the participant is in your group or channel.' },
  { value: 'ONCHAIN_TX', label: 'On-chain payment (beta)', checkLine: 'We check the payment on-chain, and that it came from the participant’s own wallet.' },
  {
    value: 'HUMANITY_VERIFICATION',
    label: claims.humanityNaming ? 'Humanity Protocol check' : 'Verified-human check',
    checkLine: 'Checked with Humanity Protocol for the participant’s wallet.',
  },
]

export const taskTypeLabel = (type: TaskType | string | undefined) => TASK_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type ?? ''

/** A new task row: the same defaults the wizard has always used (self-reported → optional). */
export const newTask = (): CampaignFormValues['tasks'][number] => ({
  type: 'SOCIAL_FOLLOW',
  isOptional: true, // self-reported → optional by default
  description: '',
  verificationData: '',
  discordInviteLink: '',
  telegramInviteLink: '',
})

/** The DOM id of a form field, from its react-hook-form path (`tasks.0.amount` → `f-tasks-0-amount`). */
export const fieldId = (path: string) => `f-${path.replace(/\./g, '-')}`

/** The fields each step validates on Continue (mirrors nextStep's trigger list). */
export const STEP_FIELDS: Record<number, string[]> = {
  1: ['title', 'shortDescription', 'description', 'dates', 'imageUrl'],
  2: ['tasks'],
  3: ['reward', 'maxParticipants'],
}

/**
 * Every error message under the given top-level fields, in form order, as {id, message} for the
 * error summary. A node with a message is a leaf (zod puts array-level issues, like a tier rule,
 * on the array itself).
 */
export function collectErrors(errors: Record<string, unknown>, roots: string[]): { id: string; message: string }[] {
  const out: { id: string; message: string }[] = []
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return
    const n = node as Record<string, unknown>
    if (typeof n.message === 'string' && n.message) {
      out.push({ id: fieldId(path), message: n.message })
      return
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === 'ref' || k === 'type' || k === 'types') continue
      walk(v, k === 'root' ? path : `${path}.${k}`)
    }
  }
  for (const r of roots) walk(errors[r], r)
  return out
}
