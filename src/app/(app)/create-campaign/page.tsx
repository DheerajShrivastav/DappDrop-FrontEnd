'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  campaignDatesSchema,
  resolveCampaignTiming,
  campaignTimingMessage,
  hasEndTimePassed,
  EXPIRED_OPEN_WARNING,
} from '@/lib/campaign-timing'
import { OpenExpiredCampaignDialog } from '@/components/open-expired-campaign-dialog'
import { CampaignScheduleField } from '@/components/campaign-schedule-field'
import { OptionCards } from '@/components/option-cards'
import { RewardTokenStatus, tokenVerdict } from '@/components/reward-token-status'
import { NftTokenTable } from '@/components/nft-token-table'
import { TierSummary, type TierFooter } from '@/components/tier-summary'
import { useRewardTokenCheck } from '@/hooks/use-reward-token-check'
import {
  MAX_TIERS,
  formatTokenAmount,
  isPositiveDecimalString,
  nextRankTier,
  nftRowsFromStrings,
  nftRowsProblem,
  nftRowsToStrings,
  parseTokenAmount,
  rankTierProblem,
  rankTiersMaxPayout,
  scoreTierProblem,
  scoreTiersMaxPerWallet,
  sortRankTiers,
  sortScoreTiers,
  type NftRow,
} from '@/lib/reward-plan'
import {
  defaultScheduleState,
  scheduleSummary,
  scheduleToDates,
  type ScheduleState,
} from '@/lib/campaign-schedule'
import {
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
  Info,
  Sparkles,
  UserPlus,
  ExternalLink,
  Bot,
  Link2,
} from 'lucide-react'

import config from '@/app/config'
import { CampaignImageUpload } from '@/components/campaign-image-upload'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useWallet } from '@/context/wallet-provider'
import React from 'react'
import { BrowserProvider } from 'ethers'
import { signAuthMessage } from '@/lib/wallet-auth'
import type { TaskType } from '@/lib/types'
import {
  becomeHost,
  createDraftCampaignWithTasks,
  configureAndFundERC20Reward,
  setCampaignMaxParticipantsOnChain,
  getProtocolFeeEnabled,
  openCampaign,
  configureRankTiers,
  configureScoreTiers,
  configureTaskPoints,
  getERC20TokenInfo,
  depositERC721Rewards,
  depositERC1155Rewards,
  getLatestBlockTimestamp,
  getCampaignById,
  quoteProtocolFee,
  type DraftTaskInput,
} from '@/lib/web3-service'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { generateCampaign } from '@/ai/flows/generate-campaign-flow'
import { parseCampaignGenerationError } from '@/ai/flows/generate-campaign.errors'
import { AlertCircle, AlertTriangle, Wifi, Clock, RefreshCw } from 'lucide-react'
import {
  Coins,
  Lock,
  ListChecks,
  MessageCircle,
  Repeat2,
  Send,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  CopyableAddress,
  ReviewRow,
  ReviewSection,
  SetupChecklist,
  ToggleCard,
} from './_components/wizard-ui'
import { HUMANITY_PRESETS } from '@/lib/humanity-presets'

// Ethereum address regex: 0x followed by 40 hex characters
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/** Stop waiting for "Generate with AI" after this long. Above the server's worst case (~70s
 * pipeline budget, src/ai/config.ts) so it only fires for a stuck or dropped request. */
const CLIENT_GENERATION_GIVE_UP_MS = 90_000

/** Comma- or newline-separated list of numeric IDs -> trimmed, non-empty strings. */
function parseIdList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

import { isAddress } from 'viem'

const taskSchema = z
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
const PLACEHOLDER_IMAGE_URL = 'https://placehold.co/600x400'

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

const campaignSchema = z.object({
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

type CampaignFormValues = z.infer<typeof campaignSchema>

const TASK_TYPE_OPTIONS: { value: TaskType; label: string; icon: LucideIcon }[] = [
  { value: 'SOCIAL_FOLLOW', label: 'Social Follow', icon: UserPlus },
  { value: 'JOIN_DISCORD', label: 'Join Discord', icon: MessageCircle },
  { value: 'JOIN_TELEGRAM', label: 'Join Telegram', icon: Send },
  { value: 'RETWEET', label: 'Retweet Post', icon: Repeat2 },
  { value: 'ONCHAIN_TX', label: 'On-chain Action (Beta)', icon: Wallet },
  { value: 'HUMANITY_VERIFICATION', label: 'Humanity Protocol Verification', icon: ShieldCheck },
]

export default function CreateCampaignPage() {
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  // Real elapsed time instead of fake stage timers: the client can't see which stage the
  // server is in, and a "Reviewing quality…" that never moves read as a hang.
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null)
  const [generationNow, setGenerationNow] = useState(() => Date.now())
  // Bumped on every start, cancel, skip and give-up. A response only applies if its id is still
  // current — so a late result can never overwrite a form the host has moved on from.
  const generationIdRef = useRef(0)
  const [generationError, setGenerationError] = useState<{
    message: string
    retryable: boolean
    category: string
  } | null>(null)
  const [isBecomingHost, setIsBecomingHost] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [campaignCreated, setCampaignCreated] = useState(false)
  // v0.6.0 Draft flow: creation is a multi-tx sequence (createCampaign -> batchAddTasks ->
  // configureERC20Reward -> fund -> setMaxParticipants), always landing in Draft. Opening is
  // a SEPARATE, explicit action gated by the go-live checklist below (FR-H6).
  const [wizardPhase, setWizardPhase] = useState<'form' | 'created'>('form')
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)
  const [creationProgress, setCreationProgress] = useState<string | null>(null)
  // Resume state (FR-H7, re-enterable wizard): persisted the MOMENT each on-chain step
  // succeeds, not just held in a local variable — if a LATER step in the sequence fails
  // (funding is a common rejection point: the host declines the approve/fund tx in their
  // wallet), retrying onSubmit must resume from the first step that hasn't succeeded, never
  // re-run createDraftCampaignWithTasks (which would create a SECOND on-chain campaign and
  // orphan the first, half-configured one).
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null)
  // The endTime actually submitted on-chain. Kept separate from the `dates` form value, which is
  // derived from "now" and would drift if read after creation — the go-live expiry warning must
  // compare against the real on-chain end, not a re-derived one.
  const [submittedEndDate, setSubmittedEndDate] = useState<Date | null>(null)
  const [pendingFunded, setPendingFunded] = useState(false)
  const [pendingTiersSet, setPendingTiersSet] = useState(false)
  const [pendingDeposited, setPendingDeposited] = useState(false)
  const [pendingCapSet, setPendingCapSet] = useState(false)
  // What was actually escrowed, captured when funding/deposit succeeds. A retry must configure
  // tiers against THIS token and its decimals, never against whatever the form holds by then.
  const [fundedReward, setFundedReward] = useState<{
    tokenAddress: string
    decimals?: number
  } | null>(null)
  const [feeEnabled, setFeeEnabled] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { address, isConnected, role, checkRoles } = useWallet()
  const uploadedImageUrlRef = useRef<string | null>(null)
  const campaignCreatedRef = useRef(false)

  // The Schedule field's input model. `dates` (what the schema validates and submit sends) is
  // always DERIVED from this via scheduleToDates — never edited directly — so the field, the
  // Review step and submit can't disagree. See src/lib/campaign-schedule.ts.
  const [schedule, setSchedule] = useState<ScheduleState>(() => defaultScheduleState())
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      title: '',
      shortDescription: '',
      description: '',
      dates: scheduleToDates(schedule, new Date()),
      imageUrl: PLACEHOLDER_IMAGE_URL,
      humanityGated: false,
      maxParticipants: '',
      tasks: [
        {
          type: 'SOCIAL_FOLLOW',
          description: '',
          verificationData: '',
          discordInviteLink: '',
          telegramInviteLink: '',
        },
      ],
      reward: {
        type: 'ERC20',
        tokenAddress: '0x' as `0x${string}`,
        amount: '',
        name: '',
        settlementMode: 'MERKLE',
        rankTiers: [],
        scoreTiers: [],
        taskPoints: [],
      },
    },
    mode: 'onChange',
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tasks',
  })
  const {
    fields: rankTierFields,
    append: appendRankTier,
    remove: removeRankTier,
  } = useFieldArray({ control: form.control, name: 'reward.rankTiers' })
  const {
    fields: scoreTierFields,
    append: appendScoreTier,
    remove: removeScoreTier,
  } = useFieldArray({ control: form.control, name: 'reward.scoreTiers' })

  const rewardType = form.watch('reward.type')
  const settlementMode = form.watch('reward.settlementMode')
  const rankTiersWatched = form.watch('reward.rankTiers')
  const scoreTiersWatched = form.watch('reward.scoreTiers')
  const taskPointsWatched = form.watch('reward.taskPoints')
  const humanityGatedWatched = form.watch('humanityGated')
  // (3) Safety net: if the go-live step is reached without the submitted end in state, read the
  // real endTime from chain rather than re-deriving it from the schedule.
  useEffect(() => {
    if (wizardPhase !== 'created' || !createdCampaignId || submittedEndDate) return
    let cancelled = false
    getCampaignById(createdCampaignId)
      .then((c) => {
        if (!cancelled && c) setSubmittedEndDate(c.endDate)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [wizardPhase, createdCampaignId, submittedEndDate])

  const applySchedule = (next: ScheduleState) => {
    setSchedule(next)
    form.setValue('dates', scheduleToDates(next, new Date()), { shouldValidate: true, shouldDirty: true })
  }
  // "As soon as it's created" and preset durations are relative to NOW, so `dates` goes stale
  // while the tab sits open. Re-derive every minute; Next and submit re-derive again anyway.
  // Stops once the campaign exists: its start/end are then fixed on-chain, and re-deriving would
  // make `dates` describe a campaign that was never submitted.
  useEffect(() => {
    if (campaignCreated) return
    const t = setInterval(() => {
      form.setValue('dates', scheduleToDates(schedule, new Date()), {
        shouldValidate: Boolean(form.formState.errors.dates),
      })
    }, 60_000)
    return () => clearInterval(t)
  }, [schedule, form, campaignCreated])
  const tasks = form.watch('tasks')

  // --- Rewards step: token pre-flight, real symbol, tier totals, fee quote ---------------------
  const rewardTokenAddress = form.watch('reward.tokenAddress')
  const rewardAmount = form.watch('reward.amount')
  const nftStandard: 'ERC721' | 'ERC1155' = form.watch('reward.nftStandard') ?? 'ERC721'
  const [nftRows, setNftRows] = useState<NftRow[]>([{ id: '', qty: '1' }])
  const applyNftRows = (rows: NftRow[]) => {
    setNftRows(rows)
    const { tokenIds, tokenAmounts } = nftRowsToStrings(rows)
    const revalidate = Boolean((form.formState.errors.reward as any)?.tokenIds)
    form.setValue('reward.tokenIds', tokenIds, { shouldDirty: true, shouldValidate: revalidate })
    form.setValue('reward.tokenAmounts', tokenAmounts, { shouldDirty: true, shouldValidate: revalidate })
  }
  const tokenCheck = useRewardTokenCheck({
    tokenAddress: rewardType === 'None' ? undefined : rewardTokenAddress,
    owner: address,
    kind: rewardType === 'ERC20' ? 'ERC20' : rewardType === 'ERC721' ? nftStandard : null,
    items: rewardType === 'ERC721' ? nftRows : undefined,
  })
  const tokenStatus =
    rewardType === 'None'
      ? null
      : tokenVerdict(tokenCheck, {
          kind: rewardType === 'ERC20' ? 'ERC20' : nftStandard,
          chainId: config.chainId,
          amount: rewardType === 'ERC20' ? rewardAmount : undefined,
          connected: Boolean(address),
        })
  const rewardToken =
    rewardType === 'ERC20' && tokenCheck.status === 'done' && tokenCheck.result.kind === 'erc20'
      ? tokenCheck.result
      : null
  const tokenSymbol = rewardToken?.symbol ?? 'tokens'
  // Reward locks after a partial create (see fundedReward). The payout method locks as soon as
  // the campaign exists: the required Humanity task is injected at creation based on it.
  const rewardLocked = pendingFunded || pendingDeposited
  const settlementLocked = campaignCreated
  const tiersEditable = rewardType === 'ERC20' && settlementMode !== 'MERKLE' && !pendingTiersSet
  const minStep = !campaignCreated ? 1 : !rewardLocked || tiersEditable ? 3 : 4
  const payoutLabel =
    settlementMode === 'RANK_TIERED'
      ? 'By finishing order'
      : settlementMode === 'SCORE_TIERED'
        ? 'By points'
        : 'Equal split'
  // No decimals fallback: every caller already requires rewardToken; if one ever doesn't, show a
  // dash rather than a number scaled by a guessed 18.
  const fmtToken = (v: bigint) =>
    rewardToken ? `${formatTokenAmount(v, rewardToken.decimals)} ${tokenSymbol}` : '—'

  const poolParsed = rewardToken && rewardAmount ? parseTokenAmount(rewardAmount, rewardToken.decimals) : null
  const poolGross = poolParsed?.ok ? poolParsed.value : null
  // The real fee from the registered fee module (quoteProtocolFee), never a hardcoded 0.
  const [feeQuote, setFeeQuote] = useState<{ gross: bigint; fee: bigint | null } | null>(null)
  useEffect(() => {
    if (poolGross === null) {
      setFeeQuote(null)
      return
    }
    let cancelled = false
    const gross = poolGross
    const t = setTimeout(() => {
      quoteProtocolFee(gross).then((fee) => {
        if (!cancelled) setFeeQuote({ gross, fee })
      })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [poolGross])
  // undefined = still loading; null = couldn't read it.
  const fee = feeQuote && poolGross !== null && feeQuote.gross === poolGross ? feeQuote.fee : undefined
  const poolNet = poolGross !== null && typeof fee === 'bigint' ? poolGross - fee : null

  const funding = ((): { gross: string; fee: string; net: string; note: string | null } => {
    if (poolGross === null) {
      return { gross: `${rewardAmount || '0'} ${tokenSymbol}`, fee: '—', net: '—', note: 'Enter a valid token and amount to see the breakdown.' }
    }
    if (fee === undefined) return { gross: fmtToken(poolGross), fee: 'Calculating…', net: '…', note: null }
    if (fee === null) {
      return feeEnabled
        ? { gross: fmtToken(poolGross), fee: 'Couldn’t read', net: 'Unknown', note: 'The fee couldn’t be read right now. Check the amounts in your wallet before signing.' }
        : { gross: fmtToken(poolGross), fee: 'None', net: fmtToken(poolGross), note: null }
    }
    return {
      gross: fmtToken(poolGross),
      fee: fee === BigInt(0) ? 'None' : fmtToken(fee),
      net: fmtToken(poolGross - fee),
      note: fee > BigInt(0) ? 'The platform fee is taken from the pool when it’s funded.' : null,
    }
  })()

  const rankPayoutFooter = ((): TierFooter => {
    if (!rewardToken || !rankTiersWatched?.length || rankTierProblem(rankTiersWatched)) return null
    const max = rankTiersMaxPayout(rankTiersWatched, rewardToken.decimals)
    if (max === null) return null
    const pool = poolNet ?? poolGross
    if (pool === null) return { tone: 'muted', text: `Tiers pay out up to ${fmtToken(max)} in total.` }
    if (max > pool) {
      return {
        tone: 'warn',
        text: `Tiers can pay out up to ${fmtToken(max)}, but only ${fmtToken(pool)} will be escrowed. If every tier fills, the last wallets to claim won’t be paid.`,
      }
    }
    return { tone: 'muted', text: `Tiers pay out up to ${fmtToken(max)} of the ${fmtToken(pool)} escrowed.` }
  })()

  const scorePayoutFooter = ((): TierFooter => {
    if (!rewardToken || !scoreTiersWatched?.length || scoreTierProblem(scoreTiersWatched)) return null
    const maxPer = scoreTiersMaxPerWallet(scoreTiersWatched, rewardToken.decimals)
    if (!maxPer) return null
    const pool = poolNet ?? poolGross
    if (pool === null) return { tone: 'muted', text: `Each wallet gets at most ${fmtToken(maxPer)}.` }
    const covers = pool / maxPer
    if (covers === BigInt(0)) {
      return { tone: 'warn', text: `The pool can’t cover even one wallet at the top tier (${fmtToken(maxPer)}).` }
    }
    return {
      tone: 'muted',
      text: `Each wallet gets at most ${fmtToken(maxPer)}. The pool covers ${covers.toString()} wallet${covers === BigInt(1) ? '' : 's'} even if all of them reach the top tier.`,
    }
  })()

  // Keep reward.taskPoints aligned 1:1 with the tasks array (index i = tasks[i]'s points) as
  // tasks are added/removed, only while SCORE_TIERED is actually selected (no-op otherwise).
  useEffect(() => {
    if (settlementMode !== 'SCORE_TIERED') return
    const current = form.getValues('reward.taskPoints') || []
    if (current.length !== tasks.length) {
      const resized = tasks.map((_, i) => current[i] ?? 0)
      form.setValue('reward.taskPoints', resized)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length, settlementMode])

  // v0.6.0 Draft flow (FR-H2..H6): createCampaign -> batchAddTasks -> configureERC20Reward
  // -> fundCampaignERC20 -> setMaxParticipants (optional). Always lands in Draft — opening is
  // a separate, explicit step gated by the go-live checklist (see wizardPhase==='created').
  const onSubmit = async (data: CampaignFormValues) => {
    if (!isConnected || !address) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please connect your wallet to create a campaign.',
      })
      return
    }
    if (data.reward.type === 'None') {
      toast({
        variant: 'destructive',
        title: 'Not available yet',
        description: 'Off-chain rewards are coming in a later phase — choose ERC20 or NFT for now.',
      })
      return
    }

    setIsLoading(true)
    // Tiered settlement has no Merkle tree to filter, so humanity gating for it is enforced by
    // a REQUIRED HUMANITY_VERIFICATION task instead (docs/HUMANITY_GATING.md point 3) —
    // auto-add one if the host enabled gating + tiered mode and didn't already add a task of
    // this type themselves. Every task the wizard creates is already required
    // (isOptional: false below), so no separate "required" flag is needed. Computed OUTSIDE the
    // "first attempt only" block below (data-only, doesn't depend on campaign state) since the
    // per-task metadata step further down needs it on a RESUMED submit too, not just the first.
    const needsAutoHumanityTask =
      data.reward.type === 'ERC20' &&
      data.humanityGated &&
      data.reward.settlementMode !== 'MERKLE' &&
      !data.tasks.some((t) => t.type === 'HUMANITY_VERIFICATION')
    // Resume from wherever a PRIOR attempt left off (FR-H7) — never re-run
    // createDraftCampaignWithTasks once a campaign already exists on-chain for this
    // wizard session, or a retry after e.g. a rejected funding tx would create a second,
    // independent campaign and orphan the first, half-configured one.
    let campaignId: string | null = pendingCampaignId
    // Decimals the funding step read on-chain in THIS submit (it throws rather than guess).
    let fundedDecimals: number | undefined
    // The Rewards inputs are locked once funded, so this only trips if that lock is bypassed —
    // but configuring tiers for a different token than the escrowed one must never happen.
    if (
      fundedReward &&
      fundedReward.tokenAddress.toLowerCase() !== (data.reward.tokenAddress || '').toLowerCase()
    ) {
      toast({
        variant: 'destructive',
        title: 'Reward doesn’t match what was funded',
        description: `This campaign was funded with ${fundedReward.tokenAddress}, so its reward can’t switch to a different token. Nothing was sent.`,
      })
      return
    }
    try {
      if (!campaignId) {
        // The contract checks startTime against the block the tx is MINED in. Resolve against
        // the latest block's timestamp (not Date.now() — a skewed local clock is exactly how a
        // "future" start ends up in the chain's past), moving any start closer than
        // START_BUFFER_SEC out. Then re-check the duration with that effective start: moving the
        // start later can push a campaign under 1 hour, and that must stop here, before any tx,
        // rather than revert on-chain.
        let chainNow: number
        try {
          chainNow = await getLatestBlockTimestamp()
        } catch {
          toast({
            variant: 'destructive',
            title: 'Could not check the network time',
            description: 'We couldn’t read the current block time, so nothing was submitted. Check your connection and try again.',
          })
          return
        }
        // Re-derive from the Schedule input against CHAIN time: "as soon as it's created" and
        // preset durations are relative to now, and `data.dates` was derived from the local clock
        // whenever it last refreshed. (The go-live step reads submittedEndDate, set below once
        // the campaign exists — not this form value.)
        const submittedDates = scheduleToDates(schedule, new Date(chainNow * 1000))
        form.setValue('dates', submittedDates)
        const timing = resolveCampaignTiming({
          pickedStart: Math.floor(submittedDates.from.getTime() / 1000),
          end: Math.floor(submittedDates.to.getTime() / 1000),
          chainNow,
        })
        const timingError = campaignTimingMessage(timing)
        if (timingError) {
          toast({ variant: 'destructive', title: 'Adjust the campaign dates', description: timingError })
          // Send the host back to where the dates live and surface the same message inline.
          setStep(1)
          form.setError('dates', { type: 'custom', message: timingError })
          return
        }
        const { startTime, endTime } = timing

        const draftTasks: DraftTaskInput[] = data.tasks.map((t) => ({
          type: t.type,
          description: t.description,
          verificationData: t.verificationData || '',
          isOptional: false,
        }))
        if (needsAutoHumanityTask) {
          draftTasks.push({
            type: 'HUMANITY_VERIFICATION',
            description: 'Verify you are human via Humanity Protocol',
            verificationData: '',
            isOptional: false,
          })
        }

        setCreationProgress('Creating campaign and adding tasks…')
        campaignId = await createDraftCampaignWithTasks({
          title: data.title,
          startTime,
          endTime,
          tasks: draftTasks,
        })
        // Persist IMMEDIATELY — this on-chain campaign now exists regardless of whether
        // any later step in this same submit succeeds.
        setPendingCampaignId(campaignId)
        setCampaignCreated(true)
        setSubmittedEndDate(new Date(timing.endTime * 1000))
      }

      if (data.reward.type === 'ERC20' && !pendingFunded) {
        setCreationProgress('Configuring and funding the reward pool…')
        const funded = await configureAndFundERC20Reward(
          campaignId,
          data.reward.tokenAddress,
          data.reward.amount,
        )
        fundedDecimals = funded.decimals
        setFundedReward({ tokenAddress: data.reward.tokenAddress, decimals: funded.decimals })
        setPendingFunded(true)
      }

      if (data.reward.type === 'ERC20' && data.reward.settlementMode !== 'MERKLE' && !pendingTiersSet) {
        setCreationProgress(
          data.reward.settlementMode === 'RANK_TIERED'
            ? 'Configuring rank tiers…'
            : 'Configuring score tiers and task points…',
        )
        // Decimals scale every tier amount, so they're never guessed: a failed read used to fall
        // back to 18, silently mis-scaling a 6-decimal token's tiers by 10^12. Use a value already
        // read for this exact token (this submit's funding step, then the Rewards-step
        // pre-flight), else read it now; if nothing is available, stop before any tier tx. The
        // pre-flight matters on a retry, where funding is skipped and this is the only read.
        const decimals =
          fundedDecimals ??
          fundedReward?.decimals ??
          rewardToken?.decimals ??
          (await getERC20TokenInfo(data.reward.tokenAddress))?.decimals
        if (decimals === undefined) {
          setCreationProgress(null)
          toast({
            variant: 'destructive',
            title: 'Couldn’t read the token’s decimals',
            description:
              'Your campaign is created and funded, but its reward tiers weren’t set. Check your connection and click Create again to finish — the steps already done are skipped.',
          })
          return
        }
        if (data.reward.settlementMode === 'RANK_TIERED') {
          await configureRankTiers(campaignId, sortRankTiers(data.reward.rankTiers || []), decimals)
        } else {
          await configureScoreTiers(campaignId, sortScoreTiers(data.reward.scoreTiers || []), decimals)
          // Points align 1:1 with the ORIGINAL tasks array by index — the auto-injected
          // HUMANITY_VERIFICATION task (if any) is appended after it and correctly gets no
          // points entry (a gating check shouldn't contribute to score).
          const pointsEntries = (data.reward.taskPoints || [])
            .map((points, taskIndex) => ({ taskIndex, points }))
            .filter((p) => p.points > 0)
          if (pointsEntries.length > 0) {
            await configureTaskPoints(campaignId, pointsEntries)
          }
        }
        setPendingTiersSet(true)
      }

      if (data.reward.type === 'ERC721' && !pendingDeposited) {
        setCreationProgress('Depositing NFTs…')
        const ids = parseIdList(data.reward.tokenIds)
        const amounts =
          data.reward.nftStandard === 'ERC1155' ? parseIdList(data.reward.tokenAmounts || '') : ids.map(() => '1')
        // Contract caps deposits at 100/call — batch larger sets transparently.
        const BATCH = 100
        for (let i = 0; i < ids.length; i += BATCH) {
          const idBatch = ids.slice(i, i + BATCH)
          const amountBatch = amounts.slice(i, i + BATCH)
          setCreationProgress(`Depositing NFTs (${i + idBatch.length}/${ids.length})…`)
          if (data.reward.nftStandard === 'ERC1155') {
            await depositERC1155Rewards(campaignId, data.reward.tokenAddress, idBatch, amountBatch)
          } else {
            await depositERC721Rewards(campaignId, data.reward.tokenAddress, idBatch)
          }
        }
        // Record what was deposited — the contract has no enumerable view of this, so the
        // NFT allocation pipeline reads it from here (src/lib/nft-allocation.ts).
        try {
          await fetch(`/api/campaigns/${campaignId}/nft-deposits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              tokenAddress: data.reward.tokenAddress,
              standard: data.reward.nftStandard,
              items: ids.map((tokenId, i) => ({ tokenId, amount: amounts[i] })),
            }),
          })
        } catch (e) {
          console.warn('Failed to record NFT deposits (non-fatal, tokens are already escrowed on-chain):', e)
        }
        setFundedReward({ tokenAddress: data.reward.tokenAddress })
        setPendingDeposited(true)
      }

      if (data.maxParticipants && Number(data.maxParticipants) > 0 && !pendingCapSet) {
        setCreationProgress('Setting participant cap…')
        await setCampaignMaxParticipantsOnChain(
          campaignId,
          Number(data.maxParticipants),
        )
        setPendingCapSet(true)
      }

      setCreationProgress('Saving campaign details…')
      // Off-chain metadata: image/descriptions/reward name + the allocation policy and
      // humanity-gating flag the pipeline will read at tree-build time (BR-G2).
      try {
        const authProvider = new BrowserProvider((window as any).ethereum)
        const signer = await signAuthMessage(authProvider)
        await fetch(`/api/campaigns/${campaignId}/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: data.imageUrl || PLACEHOLDER_IMAGE_URL,
            signature: signer.signature,
            message: signer.message,
            shortDescription: data.shortDescription || '',
            longDescription: data.description || '',
            rewardType: data.reward.type,
            // 'None' is rejected earlier in onSubmit (the type-guard toast + early return above),
            // so only ERC20/ERC721 ever reach here.
            rewardName:
              data.reward.type === 'ERC20'
                ? `${data.reward.amount} token pool`
                : `${parseIdList(data.reward.tokenIds).length} ${data.reward.nftStandard} item(s)`,
            humanityGated: data.humanityGated,
            // Descriptive only — the chain is authoritative for which mode a campaign actually
            // committed to. Tiered campaigns never go through the Merkle allocation pipeline
            // (src/lib/allocation.ts), so this label is informational/analytics, not consumed
            // by any settlement logic.
            allocationPolicy:
              data.reward.type === 'ERC20' && data.reward.settlementMode !== 'MERKLE'
                ? `ON_CHAIN_${data.reward.settlementMode}`
                : 'EQUAL_SPLIT',
          }),
        })
      } catch (metadataError) {
        console.warn('Failed to save campaign metadata:', metadataError)
      }

      // Per-task off-chain metadata (Discord/Telegram/Humanity/payment) — unchanged from
      // the prior flow, still off-chain and orthogonal to the v0.6.0 chain rewrite.
      for (let i = 0; i < data.tasks.length; i++) {
        const task = data.tasks[i]
        try {
          if (task.type === 'JOIN_DISCORD' && task.discordInviteLink) {
            await fetch('/api/campaign-task-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId: Number(campaignId),
                taskIndex: i,
                taskType: task.type,
                discordInviteLink: task.discordInviteLink,
                discordServerId: task.verificationData,
              }),
            })
          } else if (task.type === 'JOIN_TELEGRAM' && task.telegramInviteLink) {
            await fetch('/api/campaign-task-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId: Number(campaignId),
                taskIndex: i,
                taskType: task.type,
                telegramChatId: task.verificationData,
                telegramInviteLink: task.telegramInviteLink,
              }),
            })
          } else if (task.type === 'HUMANITY_VERIFICATION') {
            const preset = (task as any).humanityPreset
            await fetch('/api/campaign-task-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId: Number(campaignId),
                taskIndex: i,
                taskType: task.type,
                metadata: {
                  humanityPreset:
                    Array.isArray(preset) && preset.length > 0
                      ? preset
                      : [preset ?? 'is_human'],
                },
              }),
            })
          } else if (task.type === 'ONCHAIN_TX' && task.paymentRequired) {
            await fetch('/api/campaign-task-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId: Number(campaignId),
                taskIndex: i,
                taskType: task.type,
                metadata: {
                  paymentRequired: true,
                  paymentRecipient: task.paymentRecipient,
                  chainId: task.chainId,
                  network: task.network,
                  tokenAddress: task.tokenAddress || null,
                  tokenSymbol: task.tokenSymbol,
                  amount: task.amount,
                  amountDisplay: task.amountDisplay,
                },
              }),
            })
          }
        } catch (e) {
          console.warn(`Failed to store metadata for task ${i}:`, e)
        }
      }

      // Metadata for the auto-injected HUMANITY_VERIFICATION task (if any) — it's appended
      // after every form-entered task, so its on-chain index is data.tasks.length. Defaults to
      // the 'is_human' preset since the host never configured one for a task they didn't add.
      if (needsAutoHumanityTask) {
        try {
          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: Number(campaignId),
              taskIndex: data.tasks.length,
              taskType: 'HUMANITY_VERIFICATION',
              metadata: { humanityPreset: ['is_human'] },
            }),
          })
        } catch (e) {
          console.warn('Failed to store metadata for auto-injected humanity task:', e)
        }
      }

      setCreatedCampaignId(campaignId)
      setWizardPhase('created')
      setCreationProgress(null)
      toast({
        title: 'Campaign created!',
        description: `Campaign ${campaignId} is funded and ready — open it when you're ready to go live.`,
      })
    } catch (e) {
      setCreationProgress(null)
      // Error toast is already shown by the underlying web3-service call. Only clean up the
      // uploaded image if we never got as far as creating the on-chain campaign — once it
      // exists, the image is legitimately attached to it even if a later step failed.
      if (
        !campaignId &&
        uploadedImageUrl &&
        uploadedImageUrl !== PLACEHOLDER_IMAGE_URL
      ) {
        cleanupOrphanedImage(uploadedImageUrl)
      }
    } finally {
      setIsLoading(false)
    }
  }
  useEffect(() => {
    uploadedImageUrlRef.current = uploadedImageUrl
  }, [uploadedImageUrl])

  // FR-H5: read live whether a protocol fee module is registered, so the funding
  // itemization on the review step is honest rather than hardcoded.
  useEffect(() => {
    if (step === 4 && wizardPhase === 'form') {
      getProtocolFeeEnabled().then(setFeeEnabled)
    }
  }, [step, wizardPhase])

  useEffect(() => {
    campaignCreatedRef.current = campaignCreated
  }, [campaignCreated])

  // Cleanup orphaned image when component unmounts without successful campaign creation
  useEffect(() => {
    return () => {
      // Only cleanup if campaign was NOT successfully created
      // IMPORTANT: Use ref to get the latest value, not the stale closure value
      if (campaignCreatedRef.current) {
        console.log(
          '✅ Campaign was created successfully, skipping image cleanup',
        )
        return
      }

      // If user navigates away and there's an uploaded image that wasn't used
      const imageUrl = uploadedImageUrlRef.current || form.getValues('imageUrl')
      if (
        imageUrl &&
        imageUrl !== PLACEHOLDER_IMAGE_URL &&
        imageUrl.includes('utfs.io')
      ) {
        // Only cleanup if it's an UploadThing URL (not external URL)
        console.log('🗑️ Cleaning up orphaned image on unmount:', imageUrl)
        cleanupOrphanedImage(imageUrl)
      }
    }
  }, [])

  const cleanupOrphanedImage = async (imageUrl: string) => {
    try {
      console.log('🗑️ Cleaning up orphaned image:', imageUrl)
      await fetch('/api/uploadthing/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      console.log('✅ Orphaned image cleaned up')
    } catch (error) {
      // Silently fail - this is a cleanup operation
      console.warn('⚠️ Failed to cleanup orphaned image:', error)
    }
  }

  const handleBecomeHost = async () => {
    if (!isConnected || !address) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please connect your wallet first.',
      })
      return
    }
    setIsBecomingHost(true)
    try {
      await becomeHost()
      // Re-check role after transaction
      await checkRoles(address)
    } catch (e) {
      // Error toast is handled in the service
    } finally {
      setIsBecomingHost(false)
    }
  }

  const nextStep = async () => {
    let fieldsToValidate:
      | (keyof CampaignFormValues)[]
      | `tasks.${number}.${'description' | 'type'}`[]
      | `reward.${'type' | 'tokenAddress' | 'amount' | 'name'}`[] = []
    if (step === 1 && !campaignCreated) {
      form.setValue('dates', scheduleToDates(schedule, new Date()))
    }
    if (step === 1)
      fieldsToValidate = [
        'title',
        'shortDescription',
        'description',
        'dates',
        'imageUrl',
      ]
    if (step === 2) fieldsToValidate = ['tasks']
    if (step === 3) fieldsToValidate = ['reward', 'maxParticipants']

    const isValid = await form.trigger(fieldsToValidate as any)
    if (!isValid) return
    // The token pre-flight lives outside the schema (it's async, on-chain). Only definite
    // negatives stop the host — each one would otherwise revert AFTER createCampaign has mined.
    // Skipped once funded: the token is fixed by then, and the balance check would wrongly fail
    // because the pool has already left the host's wallet.
    if (step === 3 && rewardType !== 'None' && !rewardLocked) {
      if (tokenCheck.status === 'checking') {
        toast({ title: 'Still checking the token', description: 'Give it a second, then continue.' })
        return
      }
      if (tokenStatus?.blocking) {
        toast({ variant: 'destructive', title: 'Fix the reward before continuing', description: tokenStatus.blocking })
        return
      }
    }
    setStep((s) => s + 1)
  }

  // Back never returns to a step whose values are already on-chain: Details/Schedule/Tasks once
  // the campaign exists, and Rewards once it's funded — unless tier rows are still unset there.
  const prevStep = () => setStep((s) => Math.max(minStep, s - 1))

  const handleGenerate = async () => {
    if (!aiPrompt) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide a project description.',
      })
      return
    }
    if (aiPrompt.trim().length < 20) {
      toast({
        variant: 'destructive',
        title: 'Description Too Short',
        description:
          'Please provide at least 20 characters so the AI has enough context to work with.',
      })
      return
    }
    const myId = ++generationIdRef.current
    const isCurrent = () => generationIdRef.current === myId
    setIsGenerating(true)
    setGenerationError(null)
    setGenerationStartedAt(Date.now())
    setGenerationNow(Date.now())

    // Client-side give-up. The server budget (AI_PIPELINE_BUDGET_MS, ~70s worst case) should
    // always answer first; this only fires if the request itself is stuck or was dropped.
    const giveUp = setTimeout(() => {
      if (!isCurrent()) return
      generationIdRef.current++ // ignore whatever arrives later
      setIsGenerating(false)
      setGenerationStartedAt(null)
      setGenerationError({
        message: 'This is taking longer than usual. Try again, or create the campaign manually.',
        retryable: true,
        category: 'timeout',
      })
    }, CLIENT_GENERATION_GIVE_UP_MS)

    try {
      const result = await generateCampaign(aiPrompt)
      if (!isCurrent()) return // cancelled, skipped or given up — don't touch the form

      const currentValues = form.getValues()
      form.reset({
        ...currentValues,
        title: result.title,
        shortDescription: result.shortDescription,
        description: result.description,
        tasks: result.tasks,
      })
      toast({
        title: '✨ Campaign Drafted!',
        description:
          'AI has generated your campaign. Review and customize the details below.',
      })
      setStep(1)
    } catch (e: any) {
      if (!isCurrent()) return
      console.error('Error generating campaign:', e)

      let errorTitle = 'Generation Failed'
      let errorMessage = 'Something went wrong. Please try again.'
      let retryable = true
      let category = 'unknown'

      const parsed = parseCampaignGenerationError(e)
      if (parsed) {
        errorMessage = parsed.userMessage
        retryable = parsed.retryable
        category = parsed.category

        switch (parsed.category) {
          case 'rate_limit':
            errorTitle = '⏳ AI Service Busy'
            break
          case 'timeout':
            errorTitle = '⏳ Took Too Long'
            break
          case 'config':
            errorTitle = '🔑 Configuration Error'
            break
          case 'network':
            errorTitle = '🌐 Connection Error'
            break
          case 'validation':
            errorTitle = '📝 Invalid Input'
            break
          case 'api_error':
            errorTitle = '🤖 AI Service Error'
            break
          default:
            errorTitle = '❌ Generation Failed'
        }
      } else {
        errorMessage =
          e?.message ||
          e?.originalMessage ||
          'Could not generate the campaign. Please try again.'
      }

      setGenerationError({ message: errorMessage, retryable, category })

      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorMessage,
        duration: 8000,
      })
    } finally {
      clearTimeout(giveUp)
      if (isCurrent()) {
        setIsGenerating(false)
        setGenerationStartedAt(null)
      }
    }
  }

  /** Stop waiting. The server call can't be aborted mid-flight, but its result is ignored. */
  const cancelGeneration = () => {
    generationIdRef.current++
    setIsGenerating(false)
    setGenerationStartedAt(null)
  }

  useEffect(() => {
    if (!isGenerating) return
    const t = setInterval(() => setGenerationNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isGenerating])
  const generationSeconds =
    generationStartedAt === null ? 0 : Math.max(0, Math.floor((generationNow - generationStartedAt) / 1000))

  const steps = [
    {
      id: 1,
      name: 'Details',
      description:
        'What participants see first: the name, the pitch, when it runs and a cover image.',
    },
    {
      id: 2,
      name: 'Tasks',
      description: 'The actions participants complete to become eligible for rewards.',
    },
    {
      id: 3,
      name: 'Rewards',
      description: 'What eligible participants receive and how it is distributed.',
    },
    {
      id: 4,
      name: 'Review',
      description: 'Check everything before the campaign is created on-chain.',
    },
  ]

  if (role !== 'host') {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Card className="bg-card border shadow-elevated">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
              <UserPlus /> Become a Host
            </CardTitle>
            <CardDescription className="text-center">
              Get the HOST_ROLE to start creating campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="default" className="border-primary/20 bg-card mb-6">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle>Permissionless Hosting</AlertTitle>
              <AlertDescription>
                To create a campaign, you need the HOST_ROLE. You can grant this
                role to your connected wallet address yourself.
              </AlertDescription>
            </Alert>
            <div className="text-center">
              <p className="mb-4 text-muted-foreground">
                Click the button below to sign a transaction and grant yourself
                the HOST_ROLE.
              </p>
              <Button
                size="lg"
                onClick={handleBecomeHost}
                disabled={isBecomingHost || !isConnected}
              >
                {isBecomingHost ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Get Host Role
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Card className="bg-card border shadow-elevated">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            Create New Campaign
          </CardTitle>
          <CardDescription className="text-center">
            Follow the steps to launch your next successful campaign.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step > 0 && (
            <nav aria-label="Progress" className="mx-auto mb-10 max-w-2xl">
              <ol className="flex items-start">
                {steps.map((s, index) => {
                  const state =
                    step > s.id ? 'complete' : step === s.id ? 'current' : 'upcoming'
                  return (
                    <li
                      key={s.id}
                      aria-current={state === 'current' ? 'step' : undefined}
                      className="relative flex flex-1 flex-col items-center"
                    >
                      {/* Connector from the previous step's circle to this one. */}
                      {index > 0 && (
                        <div
                          aria-hidden
                          className={cn(
                            'absolute left-[-50%] right-1/2 top-4 h-0.5 -translate-y-1/2 transition-colors',
                            step >= s.id ? 'bg-primary' : 'bg-border',
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                          state === 'complete' && 'bg-primary text-primary-foreground',
                          state === 'current' &&
                            'border-2 border-primary bg-background text-primary ring-4 ring-primary/15',
                          state === 'upcoming' &&
                            'border-2 border-border bg-background text-muted-foreground',
                        )}
                      >
                        {state === 'complete' ? <Check className="h-4 w-4" /> : s.id}
                      </span>
                      <span
                        className={cn(
                          'mt-2 text-xs font-medium sm:text-sm',
                          state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                        )}
                      >
                        {s.name}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </nav>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {step === 0 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <h2 className="text-xl font-semibold border-b pb-2 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Generate with
                    AI
                  </h2>
                  <div className="p-6 border-dashed border-2 rounded-lg bg-secondary/50">
                    <p className="mb-1 text-sm font-medium">
                      Describe your project
                    </p>
                    <Textarea
                      placeholder="E.g., 'My project is a decentralized lending protocol on Sepolia that allows users to borrow against their NFTs...'"
                      value={aiPrompt}
                      onChange={(e) => {
                        setAiPrompt(e.target.value)
                        if (generationError) setGenerationError(null)
                      }}
                      rows={4}
                      className="bg-card"
                      disabled={isGenerating}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        Our AI will draft a campaign title, description, and
                        tasks for you.
                      </p>
                      <p
                        className={cn(
                          'text-xs tabular-nums',
                          aiPrompt.trim().length < 20
                            ? 'text-muted-foreground'
                            : 'text-foreground font-medium',
                        )}
                      >
                        {aiPrompt.trim().length}/20 min
                      </p>
                    </div>

                    {/* Honest progress: elapsed time, not a guessed stage. */}
                    {isGenerating && (
                      <div
                        className="mt-4 rounded-lg border bg-card p-4 animate-in fade-in-50"
                        role="status"
                        aria-live="polite"
                      >
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              Drafting your campaign…{' '}
                              <span className="tabular-nums text-muted-foreground">
                                {generationSeconds}s
                              </span>
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {generationSeconds < 45
                                ? 'Planning, writing and checking it — usually 10–40 seconds.'
                                : 'Still working — the AI service is slower than usual right now.'}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={cancelGeneration}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Error display with retry */}
                    {generationError && !isGenerating && (
                      <div className="mt-4 p-4 rounded-lg border border-destructive/50 bg-destructive/5 animate-in fade-in-50">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {['rate_limit', 'timeout'].includes(generationError.category) && (
                              <Clock className="h-5 w-5 text-muted-foreground" />
                            )}
                            {generationError.category === 'network' && (
                              <Wifi className="h-5 w-5 text-destructive" />
                            )}
                            {!['rate_limit', 'timeout', 'network'].includes(
                              generationError.category,
                            ) && (
                                <AlertCircle className="h-5 w-5 text-destructive" />
                              )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-destructive">
                              {generationError.message}
                            </p>
                            {generationError.retryable && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={handleGenerate}
                              >
                                <RefreshCw className="mr-2 h-3 w-3" />
                                Try Again
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-4 mt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        // Always available: a slow AI response must never trap the host here.
                        // Skipping mid-generation stops waiting so the late result can't
                        // overwrite what they type.
                        onClick={() => {
                          if (isGenerating) cancelGeneration()
                          setStep(1)
                        }}
                      >
                        Skip &amp; Create Manually
                      </Button>
                      <Button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating || aiPrompt.trim().length < 20}
                      >
                        {isGenerating ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {isGenerating ? 'Generating...' : 'Generate Campaign'}
                      </Button>
                    </div>
                  </div>
                </section>
              )}
              {step === 1 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <StepHeader title="Campaign details" description={steps[0].description} />
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Awesome Project Token Launch"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shortDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="One or two sentences that make people want to join."
                            rows={2}
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FieldHint
                          hint="Shown on the campaign card in the explore list."
                          length={field.value?.length ?? 0}
                          min={10}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detailed description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explain the project, why people should take part, and what they get for it."
                            rows={6}
                            {...field}
                          />
                        </FormControl>
                        <FieldHint
                          hint="Shown on the campaign page."
                          length={field.value?.length ?? 0}
                          min={50}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dates"
                    render={() => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Schedule</FormLabel>
                        <CampaignScheduleField value={schedule} onChange={applySchedule} />
                        <FormDescription>
                          Times are in your local time zone. Campaigns run between 1 hour and 365
                          days, and the start and end can&apos;t be changed after creation.
                        </FormDescription>
                        {/* The schema's issue sits on `dates` itself (no path) so this renders it. */}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-baseline justify-between gap-2">
                          <FormLabel>Cover image</FormLabel>
                          <span className="text-xs text-muted-foreground">Optional</span>
                        </div>
                        {/* The placeholder is the form's "no image" value, so it renders as
                            the empty dropzone rather than as a preview of a stock image. */}
                        <CampaignImageUpload
                          value={
                            uploadedImageUrl ||
                            (field.value !== PLACEHOLDER_IMAGE_URL && isHttpUrl(field.value)
                              ? field.value
                              : null)
                          }
                          onUploadComplete={(url) => {
                            setUploadedImageUrl(url)
                            form.setValue('imageUrl', url, { shouldValidate: true })
                          }}
                          onRemove={() => {
                            setUploadedImageUrl(null)
                            form.setValue('imageUrl', PLACEHOLDER_IMAGE_URL, {
                              shouldValidate: true,
                            })
                          }}
                        />
                        <div className="relative">
                          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <FormControl>
                            <Input
                              placeholder="Or paste an image URL"
                              className="pl-9"
                              {...field}
                              value={
                                uploadedImageUrl ||
                                (field.value === PLACEHOLDER_IMAGE_URL ? '' : field.value)
                              }
                              onChange={(e) => {
                                // Clearing the input means "no image", not an invalid URL.
                                field.onChange(e.target.value.trim() || PLACEHOLDER_IMAGE_URL)
                                setUploadedImageUrl(null)
                              }}
                            />
                          </FormControl>
                        </div>
                        <FormDescription>
                          Shown on the campaign card and page. You can change it after the
                          campaign is created.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="humanityGated"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormLabel
                          className={cn(
                            'flex cursor-pointer items-start gap-4 rounded-lg border p-4 font-normal transition-colors',
                            field.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-foreground/20 hover:bg-muted/40',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
                              field.value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            <ShieldCheck className="h-5 w-5" />
                          </span>
                          <span className="flex-1 space-y-1">
                            <span className="block text-sm font-medium leading-none">
                              Verified humans only
                            </span>
                            <span className="block text-sm leading-relaxed text-muted-foreground">
                              Only wallets verified with Humanity Protocol can claim rewards.
                              Unverified wallets are left out when the reward list is built,
                              so bots and duplicate wallets can&apos;t claim.
                            </span>
                          </span>
                          <FormControl>
                            <Checkbox
                              className="mt-0.5"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </section>
              )}

              {step === 2 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <StepHeader title="Tasks" description={steps[1].description} />

                  {/* Discord Bot Warning - Show if Discord tasks exist but bot URL is not configured */}
                  {tasks.some((task) => task.type === 'JOIN_DISCORD') &&
                    !config.discordBotInviteUrl && (
                      <Alert variant="destructive">
                        <Bot className="h-4 w-4" />
                        <AlertTitle>Discord verification won&apos;t work yet</AlertTitle>
                        <AlertDescription>
                          The DappDrop Discord bot isn&apos;t set up, so Discord join tasks
                          can&apos;t be verified. Contact support.
                        </AlertDescription>
                      </Alert>
                    )}

                  {/* Telegram Bot Warning - Show if Telegram tasks exist but bot username is not configured */}
                  {tasks.some((task) => task.type === 'JOIN_TELEGRAM') &&
                    !config.telegramBotUsername && (
                      <Alert variant="destructive">
                        <Bot className="h-4 w-4" />
                        <AlertTitle>Telegram verification won&apos;t work yet</AlertTitle>
                        <AlertDescription>
                          The DappDrop Telegram bot isn&apos;t set up, so Telegram join tasks
                          can&apos;t be verified. Contact support.
                        </AlertDescription>
                      </Alert>
                    )}

                  {fields.map((field, index) => {
                    const typeOption = TASK_TYPE_OPTIONS.find(
                      (o) => o.value === tasks[index]?.type,
                    )
                    const TypeIcon = typeOption?.icon ?? ListChecks
                    return (
                    <div key={field.id} className="overflow-hidden rounded-lg border bg-card">
                      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                            <TypeIcon className="h-4 w-4" />
                          </span>
                          <span className="shrink-0 text-sm font-medium">Task {index + 1}</span>
                          {typeOption && (
                            <span className="truncate text-sm text-muted-foreground">
                              {typeOption.label}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                          aria-label={`Remove task ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-4 p-4">
                      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
                        <FormField
                          control={form.control}
                          name={`tasks.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select task type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {TASK_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                    >
                                      <span className="flex min-w-0 items-center gap-2">
                                        <opt.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{opt.label}</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`tasks.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>What participants do</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g. Follow @project on X"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {tasks[index].type === 'JOIN_DISCORD' && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.verificationData`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Discord server ID</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., 1024849645714206720"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  The Discord server ID used for verification
                                  purposes.
                                </FormDescription>
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    How to get your Discord Server ID
                                  </summary>
                                  <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                                    <p>
                                      1. Enable Developer Mode in Discord
                                      Settings → Advanced → Developer Mode
                                    </p>
                                    <p>2. Right-click your server name</p>
                                    <p>3. Click "Copy Server ID"</p>
                                  </div>
                                </details>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.discordInviteLink`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Discord invite link</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., https://discord.gg/yourcode or just 'yourcode'"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  The invite link participants will use to join
                                  your Discord server
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <SetupChecklist
                            icon={Bot}
                            title="Required: add the DappDrop bot to your server"
                            steps={[
                              'Open the invite below and pick your server.',
                              'Keep the "View Server Members" and "Read Message History" permissions ticked.',
                              'Authorize. Join tasks are then verified automatically.',
                            ]}
                            action={
                              config.discordBotInviteUrl
                                ? { label: 'Add DappDrop bot to server', href: config.discordBotInviteUrl }
                                : undefined
                            }
                            missingActionText="The Discord bot invite link isn't configured. Contact support."
                          />
                        </div>
                      )}

                      {tasks[index].type === 'JOIN_TELEGRAM' && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.verificationData`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Telegram channel or group ID</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., @yourchannel or -100123456789"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  The Telegram channel/group ID or username
                                  (with @) used for verification
                                </FormDescription>
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    How to get your Telegram Channel/Group ID
                                  </summary>
                                  <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                                    <p>
                                      <strong>
                                        For Channels with username:
                                      </strong>{' '}
                                      Use @channelname
                                    </p>
                                    <p>
                                      <strong>
                                        For Groups/Channels without username:
                                      </strong>
                                    </p>
                                    <p>
                                      1. Add @userinfobot to your group/channel
                                    </p>
                                    <p>2. The bot will show the chat ID</p>
                                    <p>3. Use the ID (starts with -100)</p>
                                  </div>
                                </details>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.telegramInviteLink`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Telegram invite link</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., https://t.me/yourchannel or https://t.me/+invitecode"
                                    {...field}
                                    value={field.value ?? ''}
                                  />
                                </FormControl>
                                <FormDescription>
                                  The invite link participants will use to join
                                  your Telegram channel/group
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <SetupChecklist
                            icon={Bot}
                            title="Required: add the DappDrop bot to your channel or group"
                            steps={[
                              <>
                                Add{' '}
                                <span className="font-medium text-foreground">
                                  @{config.telegramBotUsername || 'the DappDrop bot'}
                                </span>{' '}
                                to your channel or group.
                              </>,
                              'For a channel, make it an admin. In a group it can be a regular member.',
                              'Make sure it can read messages and, for groups, see the member list.',
                            ]}
                            action={
                              config.telegramBotUsername
                                ? {
                                    label: `Open @${config.telegramBotUsername}`,
                                    href: `https://t.me/${config.telegramBotUsername}`,
                                  }
                                : undefined
                            }
                            missingActionText="The Telegram bot username isn't configured. Contact support."
                          />
                        </div>
                      )}

                      {tasks[index].type === 'ONCHAIN_TX' && (
                        <div className="space-y-4">
                          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                            <Badge variant="secondary" className="mt-px shrink-0">
                              Beta
                            </Badge>
                            <p className="text-sm text-muted-foreground">
                              On-chain actions (x402 Payment Protocol) are in beta and may change.
                            </p>
                          </div>
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.paymentRequired`}
                            render={({ field }) => (
                              <FormItem>
                                <ToggleCard
                                  icon={Coins}
                                  title="Require a payment"
                                  description="Participants complete this task by sending a crypto payment, then submitting the transaction hash."
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormItem>
                            )}
                          />

                          {tasks[index].paymentRequired && (
                            <TooltipProvider>
                              <div className="space-y-4 rounded-lg border p-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="flex items-center gap-2 text-sm font-medium">
                                    <Coins className="h-4 w-4 text-muted-foreground" />
                                    Payment details
                                  </h4>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <Info className="h-4 w-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="text-sm">
                                        Payments are verified automatically via
                                        blockchain transaction scan. Users
                                        submit their transaction hash after
                                        payment.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>

                                <FormField
                                  control={form.control}
                                  name={`tasks.${index}.paymentRecipient`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Recipient wallet
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
                                          className="font-mono text-sm"
                                          {...field}
                                          value={field.value ?? ''}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <div className="grid gap-4 sm:grid-cols-2">
                                  <FormField
                                    control={form.control}
                                    name={`tasks.${index}.network`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          Network
                                        </FormLabel>
                                        <Select
                                          onValueChange={(value) => {
                                            field.onChange(value)
                                            // Set chainId based on network
                                            const chainIds: Record<
                                              string,
                                              number
                                            > = {
                                              sepolia: 11155111,
                                              ethereum: 1,
                                              base: 8453,
                                              polygon: 137,
                                            }
                                            form.setValue(
                                              `tasks.${index}.chainId`,
                                              chainIds[value],
                                            )
                                          }}
                                          value={field.value || 'ethereum'}
                                          defaultValue="ethereum"
                                        >
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Ethereum" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="ethereum">
                                              Ethereum
                                            </SelectItem>
                                            <SelectItem value="base">
                                              Base
                                            </SelectItem>
                                            <SelectItem value="polygon">
                                              Polygon
                                            </SelectItem>
                                            <SelectItem value="sepolia">
                                              Sepolia (testnet)
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name={`tasks.${index}.tokenSymbol`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          Token
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="ETH, USDC, DAI..."
                                            className="uppercase"
                                            {...field}
                                            value={field.value ?? ''}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <FormField
                                  control={form.control}
                                  name={`tasks.${index}.tokenAddress`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="flex items-center gap-2">
                                        Token contract
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="text-xs text-muted-foreground cursor-help">
                                              (optional)
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-sm max-w-xs">
                                              Leave empty for native tokens
                                              (ETH, MATIC). For ERC-20 tokens,
                                              enter the contract address.
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="0x... or leave empty for native token"
                                          className="font-mono text-sm"
                                          {...field}
                                          value={field.value ?? ''}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <div className="grid gap-4 sm:grid-cols-2">
                                  <FormField
                                    control={form.control}
                                    name={`tasks.${index}.amount`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1">
                                          Amount
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-sm">
                                                In whole units of the token above, e.g.
                                                0.001
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            step="any"
                                            min="0"
                                            placeholder="0.001"
                                            className="font-mono text-sm"
                                            {...field}
                                            value={field.value ?? ''}
                                            onChange={(e) => {
                                              field.onChange(e)
                                              // Auto-populate display format
                                              const tokenSymbol =
                                                form.getValues(
                                                  `tasks.${index}.tokenSymbol`,
                                                ) || 'ETH'
                                              if (e.target.value) {
                                                form.setValue(
                                                  `tasks.${index}.amountDisplay`,
                                                  `${e.target.value} ${tokenSymbol}`,
                                                )
                                              }
                                            }}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name={`tasks.${index}.amountDisplay`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="flex items-center gap-1">
                                          Shown to participants as
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-sm">
                                                Human-readable format shown to
                                                users (auto-filled)
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="0.001 ETH"
                                            {...field}
                                            value={field.value ?? ''}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                  Payments are verified automatically by scanning the chain.
                                </p>
                              </div>
                            </TooltipProvider>
                          )}
                        </div>
                      )}

                      {tasks[index].type === 'HUMANITY_VERIFICATION' && (
                        <div className="space-y-4">
                          <div className="space-y-3 rounded-lg border p-4">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                              <h4 className="text-sm font-medium">
                                Verification checks
                              </h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Select one or more Humanity Protocol checks users
                              must pass to complete this task.
                            </p>
                            <FormField
                              control={form.control}
                              name={`tasks.${index}.humanityPreset`}
                              render={({ field }) => {
                                const selected: string[] = Array.isArray(
                                  field.value,
                                )
                                  ? field.value
                                  : field.value
                                    ? [field.value]
                                    : ['is_human']

                                const toggle = (preset: string) => {
                                  const next = selected.includes(preset)
                                    ? selected.filter((p) => p !== preset)
                                    : [...selected, preset]
                                  // Ensure at least one preset is always selected
                                  field.onChange(
                                    next.length > 0 ? next : ['is_human'],
                                  )
                                }

                                // Group presets by category
                                const categories = [
                                  { key: 'identity', label: 'Identity' },
                                  { key: 'kyc', label: 'KYC' },
                                ] as const

                                return (
                                  <FormItem className="space-y-3">
                                    <FormLabel>
                                      Required checks ({selected.length}{' '}
                                      selected)
                                    </FormLabel>
                                    {categories.map((cat) => {
                                      const presets = HUMANITY_PRESETS.filter(
                                        (p) => p.category === cat.key,
                                      )
                                      if (presets.length === 0) return null
                                      return (
                                        <div
                                          key={cat.key}
                                          className="space-y-1.5"
                                        >
                                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            {cat.label}
                                          </p>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {presets.map((p) => {
                                              const isChecked =
                                                selected.includes(p.preset)
                                              return (
                                                <label
                                                  key={p.preset}
                                                  className={cn(
                                                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                                                    isChecked
                                                      ? 'border-primary bg-primary/5'
                                                      : 'hover:border-foreground/20 hover:bg-muted/40',
                                                  )}
                                                >
                                                  <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={() =>
                                                      toggle(p.preset)
                                                    }
                                                    className="mt-0.5"
                                                  />
                                                  <div className="space-y-0.5 flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-sm">
                                                        {p.icon}
                                                      </span>
                                                      <span className="text-sm font-medium truncate">
                                                        {p.label}
                                                      </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-snug">
                                                      {p.description}
                                                    </p>
                                                  </div>
                                                </label>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )
                                    })}
                                    <FormDescription>
                                      Users must pass <strong>all</strong>{' '}
                                      selected checks to complete this task.
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )
                              }}
                            />
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full border-dashed text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      append({
                        type: 'SOCIAL_FOLLOW',
                        description: '',
                        verificationData: '',
                        discordInviteLink: '',
                        telegramInviteLink: '',
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add task
                    <span className="ml-1.5 text-muted-foreground">
                      · {fields.length} so far
                    </span>
                  </Button>
                </section>
              )}

              {step === 3 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <StepHeader title="Rewards" description={steps[2].description} />
                  {rewardLocked ? (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Funded on-chain</p>
                          <p className="text-sm text-muted-foreground">
                            The reward can&apos;t be changed now.
                            {tiersEditable
                              ? ' You can still fix the tiers below, then finish setup on the Review step.'
                              : ' Finish setup on the Review step.'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 border-t pt-3">
                        <ReviewRow label={rewardType === 'ERC20' ? 'Pool' : 'Items'}>
                          <span className="font-medium tabular-nums">
                            {rewardType === 'ERC20'
                              ? `${Number.isFinite(Number(rewardAmount)) ? Number(rewardAmount).toLocaleString(undefined, { maximumFractionDigits: 18 }) : rewardAmount} ${tokenSymbol}`
                              : `${parseIdList(form.getValues('reward.tokenIds') || '').length} × ${nftStandard}`}
                          </span>
                        </ReviewRow>
                        <ReviewRow label={rewardType === 'ERC20' ? 'Token' : 'Collection'}>
                          <CopyableAddress address={fundedReward?.tokenAddress ?? rewardTokenAddress ?? ''} />
                        </ReviewRow>
                        {rewardType === 'ERC20' && (
                          <ReviewRow label="Payout">
                            {payoutLabel}
                          </ReviewRow>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                  <FormField
                    control={form.control}
                    name="reward.type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="space-y-1">
                          <FormLabel>Reward type</FormLabel>
                          <FormDescription>
                            Rewards are escrowed when the campaign is created and paid out after it
                            ends.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <OptionCards
                            ariaLabel="Reward type"
                            value={field.value}
                            onChange={field.onChange}
                            columns={3}
                            options={[
                              { value: 'ERC20', title: 'Token pool', description: 'An ERC20 token, escrowed now and paid out after the campaign ends.' },
                              { value: 'ERC721', title: 'NFTs', description: 'ERC721 or ERC1155 items, one per qualifying wallet.' },
                              { value: 'None', title: 'Something else', description: 'A text reward, like a Discord role.', hint: 'Coming in a later phase', disabled: true },
                            ]}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {rewardType === 'ERC721' && (
                    <FormField
                      control={form.control}
                      name="reward.nftStandard"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>NFT standard</FormLabel>
                          <FormControl>
                            <OptionCards
                              ariaLabel="NFT standard"
                              value={field.value ?? 'ERC721'}
                              onChange={field.onChange}
                              columns={2}
                              options={[
                                { value: 'ERC721', title: 'ERC721', description: 'Each token ID is one unique item.' },
                                { value: 'ERC1155', title: 'ERC1155', description: 'Each token ID can have a quantity.' },
                              ]}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  {rewardType !== 'None' && (
                    <FormField
                      control={form.control}
                      name="reward.tokenAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {rewardType === 'ERC20' ? 'Token contract address' : 'NFT contract address'}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="0x…"
                              className="font-mono"
                              autoComplete="off"
                              spellCheck={false}
                              {...field}
                              value={field.value === '0x' ? '' : field.value}
                            />
                          </FormControl>
                          {/* Pre-flight: is it a contract on this network, the right kind, and do
                              you hold enough — before any transaction (see tokenVerdict). */}
                          <RewardTokenStatus verdict={tokenStatus} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {rewardType === 'ERC20' && (
                    <FormField
                      control={form.control}
                      name="reward.amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total reward pool</FormLabel>
                          <div className="relative">
                            <FormControl>
                              {/* Text + inputMode, not type="number": a number box changes value
                                  when the page is scrolled over it and accepts "1e5". */}
                              <Input
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="10000"
                                className={cn('font-mono', rewardToken && 'pr-20')}
                                {...field}
                              />
                            </FormControl>
                            {rewardToken && (
                              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                                {rewardToken.symbol}
                              </span>
                            )}
                          </div>
                          <FormDescription>
                            The total escrowed on-chain when you create the campaign.
                            {settlementMode === 'MERKLE'
                              ? ' After it ends, it’s split equally among every wallet that completed all tasks.'
                              : ' Paid out by the tiers below.'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                    </>
                  )}
                  {!rewardLocked && settlementLocked && rewardType === 'ERC20' && (
                    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">Payout: </span>
                          {payoutLabel}
                        </p>
                        <p className="text-muted-foreground">
                          Set when the campaign was created on-chain, so it can&apos;t be changed now.
                        </p>
                      </div>
                    </div>
                  )}
                  {rewardType === 'ERC20' && !settlementLocked && (
                    <FormField
                      control={form.control}
                      name="reward.settlementMode"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>How the pool is paid out</FormLabel>
                          <FormControl>
                            <OptionCards
                              ariaLabel="Settlement mode"
                              value={field.value ?? 'MERKLE'}
                              onChange={field.onChange}
                              options={[
                                {
                                  value: 'MERKLE',
                                  title: 'Equal split',
                                  description:
                                    'Everyone who completes every task gets the same share. Allocations are published after the campaign ends, with a 24-hour review window before claims open.',
                                  hint: 'Best for: simple, fair drops',
                                },
                                {
                                  value: 'RANK_TIERED',
                                  title: 'By finishing order',
                                  description:
                                    'Pay by who finishes first — e.g. the first 10 wallets get 100 each. Worked out on-chain; claims open as soon as the campaign ends.',
                                  hint: 'Best for: races and early-bird rewards',
                                },
                                {
                                  value: 'SCORE_TIERED',
                                  title: 'By points',
                                  description:
                                    'Each task is worth points; wallets are paid by the tier their score reaches. Worked out on-chain; claims open as soon as the campaign ends.',
                                  hint: 'Best for: rewarding deeper engagement',
                                },
                              ]}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                  {rewardType === 'ERC20' && settlementMode === 'RANK_TIERED' && !pendingTiersSet && (
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-medium">Rank tiers</h4>
                          <p className="text-xs text-muted-foreground">
                            Rank 1 is the first wallet to complete every task. Up to {MAX_TIERS} tiers.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={(rankTiersWatched?.length ?? 0) >= MAX_TIERS}
                          // Continues right after the highest rank already covered, so tiers never
                          // overlap by default (setRankTiers rejects overlaps).
                          onClick={() => appendRankTier(nextRankTier(rankTiersWatched || []))}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Add tier
                        </Button>
                      </div>
                      {rankTierFields.length > 0 && (
                        <div
                          aria-hidden
                          className="hidden grid-cols-[1fr_1fr_1.4fr_2.5rem] gap-2 text-xs font-medium text-muted-foreground sm:grid"
                        >
                          <span>From rank</span>
                          <span>To rank</span>
                          <span>{rewardToken ? `${rewardToken.symbol} each` : 'Amount each'}</span>
                        </div>
                      )}
                      {rankTierFields.map((f, i) => (
                        <div
                          key={f.id}
                          className="grid grid-cols-2 items-end gap-2 border-b pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_1fr_1.4fr_2.5rem] sm:border-b-0 sm:pb-0"
                        >
                          <FormField
                            control={form.control}
                            name={`reward.rankTiers.${i}.startRank`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs sm:sr-only">From rank</FormLabel>
                                <FormControl>
                                  <Input inputMode="numeric" className="font-mono" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`reward.rankTiers.${i}.endRank`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs sm:sr-only">To rank</FormLabel>
                                <FormControl>
                                  <Input inputMode="numeric" className="font-mono" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`reward.rankTiers.${i}.amount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs sm:sr-only">
                                  {rewardToken ? `${rewardToken.symbol} each` : 'Amount each'}
                                </FormLabel>
                                <FormControl>
                                  <Input inputMode="decimal" placeholder="100" className="font-mono" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove tier ${i + 1}`}
                            className="justify-self-end text-muted-foreground hover:text-destructive"
                            onClick={() => removeRankTier(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <TierSummary
                        problem={rankTiersWatched?.length ? rankTierProblem(rankTiersWatched) : null}
                        schemaMessage={(form.formState.errors.reward as any)?.rankTiers?.message}
                        rows={sortRankTiers(rankTiersWatched || []).map((t) => ({
                          label:
                            Number(t.startRank) === Number(t.endRank)
                              ? `Rank ${t.startRank}`
                              : `Ranks ${t.startRank}–${t.endRank}`,
                          value: `${t.amount || '0'} ${tokenSymbol} each`,
                        }))}
                        footer={rankPayoutFooter}
                      />
                    </div>
                  )}
                  {rewardType === 'ERC20' && settlementMode === 'SCORE_TIERED' && !pendingTiersSet && (
                    <div className="space-y-4">
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-medium">Score tiers</h4>
                            <p className="text-xs text-muted-foreground">
                              A wallet is paid by the highest tier its score reaches. Any order is fine.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={(scoreTiersWatched?.length ?? 0) >= MAX_TIERS}
                            onClick={() =>
                              appendScoreTier({
                                // A fresh minimum above every existing one, so two tiers never
                                // start out with the same threshold (setScoreTiers rejects that).
                                minScore: (scoreTiersWatched || []).reduce(
                                  (m, t) => Math.max(m, Number(t.minScore) + 1 || 0),
                                  0,
                                ),
                                amount: '',
                              })
                            }
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add tier
                          </Button>
                        </div>
                        {scoreTierFields.length > 0 && (
                          <div
                            aria-hidden
                            className="hidden grid-cols-[1fr_1.4fr_2.5rem] gap-2 text-xs font-medium text-muted-foreground sm:grid"
                          >
                            <span>Minimum score</span>
                            <span>{rewardToken ? `${rewardToken.symbol} per wallet` : 'Amount per wallet'}</span>
                          </div>
                        )}
                        {scoreTierFields.map((f, i) => (
                          <div key={f.id} className="grid grid-cols-[1fr_1fr_2.5rem] items-end gap-2 sm:grid-cols-[1fr_1.4fr_2.5rem]">
                            <FormField
                              control={form.control}
                              name={`reward.scoreTiers.${i}.minScore`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs sm:sr-only">Minimum score</FormLabel>
                                  <FormControl>
                                    <Input inputMode="numeric" className="font-mono" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`reward.scoreTiers.${i}.amount`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs sm:sr-only">
                                    {rewardToken ? `${rewardToken.symbol} per wallet` : 'Amount per wallet'}
                                  </FormLabel>
                                  <FormControl>
                                    <Input inputMode="decimal" placeholder="100" className="font-mono" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove tier ${i + 1}`}
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeScoreTier(i)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <TierSummary
                          problem={scoreTiersWatched?.length ? scoreTierProblem(scoreTiersWatched) : null}
                          schemaMessage={(form.formState.errors.reward as any)?.scoreTiers?.message}
                          rows={sortScoreTiers(scoreTiersWatched || []).map((t) => ({
                            label: `Score ${t.minScore}+`,
                            value: `${t.amount || '0'} ${tokenSymbol}`,
                          }))}
                          footer={scorePayoutFooter}
                        />
                      </div>
                      <div className="space-y-3 rounded-lg border p-4">
                        <h4 className="text-sm font-medium">Points per task</h4>
                        <FormDescription>
                          How many points each task adds to a wallet&apos;s score. A task with 0 points
                          doesn&apos;t affect scoring.
                        </FormDescription>
                        {tasks.map((t, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm text-muted-foreground">
                              [{TASK_TYPE_OPTIONS.find((o) => o.value === t.type)?.label}]{' '}
                              {t.description || '(no description yet)'}
                            </span>
                            <FormField
                              control={form.control}
                              name={`reward.taskPoints.${i}`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input inputMode="numeric" className="w-20 font-mono" aria-label={`Points for task ${i + 1}`} {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        ))}
                        {(form.formState.errors.reward as any)?.taskPoints?.message && (
                          <p className="text-sm font-medium text-destructive">
                            {(form.formState.errors.reward as any).taskPoints.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {rewardType === 'ERC20' &&
                    settlementMode !== 'MERKLE' &&
                    humanityGatedWatched && (
                      <Alert>
                        <ShieldCheck className="h-4 w-4" />
                        <AlertTitle>
                          A required Humanity Verification task will be added
                        </AlertTitle>
                        <AlertDescription>
                          Tiered settlement has no Merkle tree to filter — humanity gating for
                          this campaign is enforced by a required &quot;Verify you&apos;re
                          human&quot; task instead (docs/HUMANITY_GATING.md). It&apos;s added
                          automatically; you don&apos;t need to add it yourself.
                        </AlertDescription>
                      </Alert>
                    )}
                  {rewardType === 'ERC721' && !rewardLocked && (
                    <FormField
                      control={form.control}
                      name="reward.tokenIds"
                      render={() => (
                        <FormItem>
                          <FormLabel>Tokens to deposit</FormLabel>
                          <NftTokenTable rows={nftRows} onChange={applyNftRows} standard={nftStandard} />
                          <FormDescription>
                            Each row is one prize for one qualifying wallet. More than 100 are
                            deposited in automatic batches.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {rewardType === 'None' && (
                    <FormField
                      control={form.control}
                      name="reward.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reward description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., A special role in our Discord"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="maxParticipants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Participant cap (optional)</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="numeric"
                            placeholder="Leave blank for unlimited"
                            className="font-mono"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Once this many wallets have qualified, joining closes
                          (up to 100,000). Leave blank for unlimited.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>
              )}

              {step === 4 && wizardPhase === 'form' && (
                <section className="space-y-6 animate-in fade-in-50">
                  <StepHeader title="Review &amp; create" description={steps[3].description} />
                  {(() => {
                    const v = form.getValues()
                    const coverUrl =
                      v.imageUrl && v.imageUrl !== PLACEHOLDER_IMAGE_URL ? v.imageUrl : null
                    // reward is a union by type; path reads keep each field typed regardless.
                    const rewardAmount = form.getValues('reward.amount')
                    const rewardTokenAddress = form.getValues('reward.tokenAddress') || ''
                    const nftStd = form.getValues('reward.nftStandard') ?? 'ERC721'
                    const nftCount = parseIdList(form.getValues('reward.tokenIds') || '').length
                    const summary = scheduleSummary(schedule, new Date())
                    // Once the campaign exists on-chain its details and tasks are fixed, so only
                    // the reward (configured in later transactions) can still be edited.
                    const editable = !campaignCreated
                    const payout =
                      rewardType === 'ERC721'
                        ? 'One item per qualifying wallet'
                        : settlementMode === 'RANK_TIERED'
                          ? `By finishing order · ${(rankTiersWatched || []).length} tier(s)`
                          : settlementMode === 'SCORE_TIERED'
                            ? `By points · ${(scoreTiersWatched || []).length} tier(s)`
                            : 'Equal split among wallets that complete every task'
                    const humanityNote = humanityGatedWatched
                      ? rewardType === 'ERC20' && settlementMode !== 'MERKLE'
                        ? 'A required Humanity verification task is added'
                        : 'Humanity-verified wallets only'
                      : null
                    // `done` mirrors the resume flags onSubmit skips on a retry.
                    const txSteps = [
                      { label: 'Create the campaign and add its tasks', done: campaignCreated },
                      {
                        label:
                          rewardType === 'ERC20'
                            ? `Set the reward token, approve ${tokenSymbol} if needed, and fund the pool`
                            : `Deposit ${nftCount} ${nftStd} item(s), approving the collection first if needed`,
                        done: rewardLocked,
                      },
                      rewardType === 'ERC20' && settlementMode === 'RANK_TIERED'
                        ? { label: 'Set the rank tiers', done: pendingTiersSet }
                        : null,
                      rewardType === 'ERC20' && settlementMode === 'SCORE_TIERED'
                        ? { label: 'Set the score tiers and task points', done: pendingTiersSet }
                        : null,
                      v.maxParticipants ? { label: 'Set the participant cap', done: pendingCapSet } : null,
                      { label: 'Sign a message to save the image and descriptions (no gas)', done: false },
                    ].filter((x): x is { label: string; done: boolean } => !!x)

                    return (
                      <>
                        <div className="divide-y overflow-hidden rounded-lg border bg-card">
                          <ReviewSection title="Campaign" onEdit={editable ? () => setStep(1) : undefined}>
                            <div className="flex gap-4">
                              <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-md border bg-muted sm:w-36">
                                {coverUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                    No image
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 space-y-1">
                                <p className="font-semibold leading-snug">{v.title}</p>
                                <p className="text-sm text-muted-foreground">{v.shortDescription}</p>
                                {v.humanityGated && (
                                  <Badge variant="secondary" className="mt-1 gap-1">
                                    <ShieldCheck className="h-3 w-3" /> Verified humans only
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </ReviewSection>

                          <ReviewSection title="Schedule" onEdit={editable ? () => setStep(1) : undefined}>
                            <div className="space-y-1 text-sm">
                              <p>{summary.primary}</p>
                              <p className="text-muted-foreground">{summary.utc}</p>
                              <p className="text-xs text-muted-foreground">
                                Start and end times can&apos;t be changed after the campaign is created.
                              </p>
                            </div>
                          </ReviewSection>

                          <ReviewSection title="Reward" onEdit={minStep <= 3 ? () => setStep(3) : undefined}>
                            <div className="space-y-2">
                              <ReviewRow label={rewardType === 'ERC20' ? 'Pool' : 'Items'}>
                                <span className="font-medium tabular-nums">
                                  {rewardType === 'ERC20'
                                    ? `${Number.isFinite(Number(rewardAmount)) ? Number(rewardAmount).toLocaleString(undefined, { maximumFractionDigits: 18 }) : rewardAmount} ${tokenSymbol}`
                                    : `${nftCount} × ${nftStd}`}
                                </span>
                              </ReviewRow>
                              <ReviewRow label={rewardType === 'ERC20' ? 'Token' : 'Collection'}>
                                <CopyableAddress address={rewardTokenAddress} />
                              </ReviewRow>
                              <ReviewRow label="Payout">{payout}</ReviewRow>
                              {humanityNote && <ReviewRow label="Eligibility">{humanityNote}</ReviewRow>}
                              {v.maxParticipants && (
                                <ReviewRow label="Participant cap">
                                  <span className="tabular-nums">
                                    {Number(v.maxParticipants).toLocaleString()} wallets
                                  </span>
                                </ReviewRow>
                              )}
                            </div>
                          </ReviewSection>

                          <ReviewSection
                            title={`Tasks (${v.tasks.length})`}
                            onEdit={editable ? () => setStep(2) : undefined}
                          >
                            <ol className="space-y-2">
                              {v.tasks.map((task, i) => {
                                const opt = TASK_TYPE_OPTIONS.find((t) => t.value === task.type)
                                const Icon = opt?.icon ?? ListChecks
                                return (
                                  <li key={i} className="flex items-start gap-3 text-sm">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                                      {i + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">{task.description}</span>
                                    <Badge variant="outline" className="shrink-0 gap-1 font-normal">
                                      <Icon className="h-3 w-3" />
                                      {opt?.label}
                                    </Badge>
                                  </li>
                                )
                              })}
                            </ol>
                          </ReviewSection>
                        </div>

                        {/* FR-H5: itemize the funding transaction before the host signs it. */}
                        {rewardType === 'ERC20' ? (
                          <div className="space-y-2 rounded-lg border p-4">
                            <h3 className="text-sm font-medium">Funding breakdown</h3>
                            <div className="flex justify-between gap-4 text-sm">
                              <span className="text-muted-foreground">Taken from your wallet</span>
                              <span className="text-right tabular-nums">{funding.gross}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-sm">
                              <span className="text-muted-foreground">Protocol fee</span>
                              <span className="text-right tabular-nums">{funding.fee}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-t pt-2 text-sm font-semibold">
                              <span>Escrowed for rewards</span>
                              <span className="text-right tabular-nums">{funding.net}</span>
                            </div>
                            {funding.note && (
                              <p className="text-xs text-muted-foreground">{funding.note}</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 rounded-lg border p-4">
                            <h3 className="text-sm font-medium">NFTs to deposit</h3>
                            <div className="flex justify-between gap-4 text-sm font-semibold">
                              <span>{nftStd} items</span>
                              <span className="tabular-nums">{nftCount}</span>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-sm font-medium">What happens when you click Create</h3>
                          </div>
                          <ol className="space-y-2">
                            {txSteps.map((t, i) => (
                              <li key={i} className="flex gap-3 text-sm">
                                <span
                                  className={cn(
                                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
                                    t.done ? 'border-primary bg-primary text-primary-foreground' : 'bg-background',
                                  )}
                                >
                                  {t.done ? <Check className="h-3 w-3" /> : i + 1}
                                </span>
                                <span className={cn(t.done && 'text-muted-foreground')}>
                                  {t.label}
                                  {t.done && <span className="ml-1.5 text-xs">· Done</span>}
                                </span>
                              </li>
                            ))}
                          </ol>
                          <p className="text-xs text-muted-foreground">
                            Your wallet asks you to confirm each step. If one fails, click Create
                            again and the finished steps are skipped. The campaign is created as a
                            Draft; you open it to participants in a separate, final step.
                          </p>
                        </div>
                      </>
                    )
                  })()}
                </section>
              )}

              {step === 4 && wizardPhase === 'created' && createdCampaignId && (
                <GoLiveChecklist
                  campaignId={createdCampaignId}
                  endDate={submittedEndDate ?? undefined}
                  isOpening={isOpening}
                  onOpen={async () => {
                    setIsOpening(true)
                    try {
                      await openCampaign(createdCampaignId, toast)
                      router.push(`/campaign/${createdCampaignId}`)
                    } catch {
                      // Error toast already shown by openCampaign.
                    } finally {
                      setIsOpening(false)
                    }
                  }}
                  onLater={() => router.push(`/campaign/${createdCampaignId}`)}
                />
              )}

              {step > 0 && wizardPhase === 'form' && (
                <div className="mt-8 flex items-center justify-between gap-4 border-t pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={prevStep}
                    disabled={step <= minStep}
                    className={cn(step <= minStep && 'invisible')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>

                  <span className="text-sm tabular-nums text-muted-foreground">
                    Step {step} of {steps.length}
                  </span>

                  {step < 4 ? (
                    <Button type="button" onClick={nextStep}>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {creationProgress || (campaignCreated ? 'Finish setup' : 'Create Campaign')}
                    </Button>
                  )}
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1 border-b pb-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

/** Helper text on the left, a live character count on the right until the minimum is met. */
function FieldHint({ hint, length, min }: { hint: string; length: number; min: number }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm text-muted-foreground">
      <p>{hint}</p>
      <p className={cn('shrink-0 tabular-nums', length >= min && 'text-status-claimable-fg')}>
        {length < min ? `${length}/${min} min` : `${length} characters`}
      </p>
    </div>
  )
}

/** FR-H6: hard-blocks Open until tasks exist AND the reward is configured+funded — both are
 * always true by the time this renders, since creation only reaches wizardPhase 'created'
 * after the full Draft+fund sequence succeeds. Opening is a separate, explicit action; a
 * completed Draft can sit indefinitely (FR-H7) via "I'll open it later". */
function GoLiveChecklist({
  campaignId,
  endDate,
  isOpening,
  onOpen,
  onLater,
}: {
  campaignId: string
  /** The end time submitted on-chain (the wizard's `dates.to`). */
  endDate?: Date
  isOpening: boolean
  onOpen: () => void
  onLater: () => void
}) {
  // Re-evaluated every 30s: a host can sit on this screen past the end time (the minimum
  // campaign is only 1 hour), and the checklist must not keep claiming the times are fine.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  const [confirmExpiredOpen, setConfirmExpiredOpen] = useState(false)
  const endPassed = endDate ? hasEndTimePassed(endDate, now) : false

  return (
    <section className="space-y-6 animate-in fade-in-50">
      <h2 className="text-xl font-semibold border-b pb-2">Go live</h2>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Campaign {campaignId} was created and funded. It's in{' '}
          <strong>Draft</strong> — participants can't see or join it until you
          open it.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-status-claimable-fg" /> Tasks added
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-status-claimable-fg" /> Reward configured and
            funded
          </li>
          <li className="flex items-center gap-2">
            {endPassed ? (
              <>
                <AlertTriangle className="h-4 w-4 text-destructive" /> End time has passed
              </>
            ) : (
              <>
                <Check className="h-4 w-4 text-status-claimable-fg" /> Start/end times valid
              </>
            )}
          </li>
        </ul>
        {endPassed && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>End time has passed</AlertTitle>
            <AlertDescription>{EXPIRED_OPEN_WARNING}</AlertDescription>
          </Alert>
        )}
        <OpenExpiredCampaignDialog
          open={confirmExpiredOpen}
          onOpenChange={setConfirmExpiredOpen}
          onConfirm={onOpen}
        />
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => {
              // Re-check at click time, not just render time — the interval can be up to 30s stale.
              if (endDate && hasEndTimePassed(endDate)) setConfirmExpiredOpen(true)
              else onOpen()
            }}
            disabled={isOpening}
          >
            {isOpening && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Open Campaign
          </Button>
          <Button variant="outline" onClick={onLater}>
            I'll open it later
          </Button>
        </div>
      </div>
    </section>
  )
}
