'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { addDays, format, setHours, setMinutes } from 'date-fns'
import {
  Calendar as CalendarIcon,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
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
  type DraftTaskInput,
} from '@/lib/web3-service'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { generateCampaign } from '@/ai/flows/generate-campaign-flow'
import {
  parseCampaignGenerationError,
  type GenerationStage,
} from '@/ai/flows/generate-campaign.errors'
import { AlertCircle, Wifi, Clock, RefreshCw } from 'lucide-react'
import { HUMANITY_PRESETS } from '@/lib/humanity-presets'

// Ethereum address regex: 0x followed by 40 hex characters
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

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

const campaignSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  shortDescription: z
    .string()
    .min(10, 'Short description must be at least 10 characters long.'),
  description: z
    .string()
    .min(50, 'Detailed description must be at least 50 characters long.'),
  dates: z
    .object({
      from: z.date({ required_error: 'Start date is required.' }),
      to: z.date({ required_error: 'End date is required.' }),
    })
    .refine((data) => data.to > data.from, {
      message: 'End date must be after the start date.',
      path: ['to'],
    }),
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
      amount: z.string().min(1, 'Amount is required for ERC20 tokens.'),
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
            amount: z.string().min(1),
          }),
        )
        .optional(),
      scoreTiers: z
        .array(
          z.object({
            minScore: z.coerce.number().int().min(0),
            amount: z.string().min(1),
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
    }),
    z.object({
      type: z.literal('None'),
      name: z.string().min(1, 'A description of the reward is required.'),
    }),
  ]),
}).superRefine((data, ctx) => {
  if (data.reward.type !== 'ERC20') return
  if (data.reward.settlementMode === 'RANK_TIERED') {
    if (!data.reward.rankTiers || data.reward.rankTiers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one rank tier.',
        path: ['reward', 'rankTiers'],
      })
    }
  }
  if (data.reward.settlementMode === 'SCORE_TIERED') {
    if (!data.reward.scoreTiers || data.reward.scoreTiers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one score tier.',
        path: ['reward', 'scoreTiers'],
      })
    }
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

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'SOCIAL_FOLLOW', label: 'Social Follow' },
  { value: 'JOIN_DISCORD', label: 'Join Discord' },
  { value: 'JOIN_TELEGRAM', label: 'Join Telegram' },
  { value: 'RETWEET', label: 'Retweet Post' },
  { value: 'ONCHAIN_TX', label: 'On-chain Action (Beta)' },
  { value: 'HUMANITY_VERIFICATION', label: 'Humanity Protocol Verification' },
]

export default function CreateCampaignPage() {
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStage, setGenerationStage] =
    useState<GenerationStage | null>(null)
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
  const [pendingFunded, setPendingFunded] = useState(false)
  const [pendingTiersSet, setPendingTiersSet] = useState(false)
  const [pendingCapSet, setPendingCapSet] = useState(false)
  const [feeEnabled, setFeeEnabled] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { address, isConnected, role, checkRoles } = useWallet()
  const uploadedImageUrlRef = useRef<string | null>(null)
  const campaignCreatedRef = useRef(false)

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      title: '',
      shortDescription: '',
      description: '',
      dates: {
        from: new Date(),
        to: addDays(new Date(), 1),
      },
      imageUrl: `https://placehold.co/600x400`,
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
  const dates = form.watch('dates')
  const tasks = form.watch('tasks')

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
    if (data.reward.type !== 'ERC20') {
      toast({
        variant: 'destructive',
        title: 'Not available yet',
        description:
          'NFT and off-chain rewards are coming in a later phase — choose ERC20 for now.',
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
    try {
      if (!campaignId) {
        // Contract requires strictly-future start times; nudge a "now" default forward
        // rather than let the tx revert on a stale default.
        const now = Math.floor(Date.now() / 1000)
        const userStart = Math.floor(data.dates.from.getTime() / 1000)
        const startTime = userStart <= now ? now + 60 : userStart
        const endTime = Math.floor(data.dates.to.getTime() / 1000)

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
      }

      if (!pendingFunded) {
        setCreationProgress('Configuring and funding the reward pool…')
        await configureAndFundERC20Reward(
          campaignId,
          data.reward.tokenAddress,
          data.reward.amount,
        )
        setPendingFunded(true)
      }

      if (data.reward.settlementMode !== 'MERKLE' && !pendingTiersSet) {
        setCreationProgress(
          data.reward.settlementMode === 'RANK_TIERED'
            ? 'Configuring rank tiers…'
            : 'Configuring score tiers and task points…',
        )
        const tokenInfo = await getERC20TokenInfo(data.reward.tokenAddress)
        const decimals = tokenInfo?.decimals ?? 18
        if (data.reward.settlementMode === 'RANK_TIERED') {
          await configureRankTiers(campaignId, data.reward.rankTiers || [], decimals)
        } else {
          await configureScoreTiers(campaignId, data.reward.scoreTiers || [], decimals)
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
            imageUrl: data.imageUrl || 'https://placehold.co/600x400',
            signature: signer.signature,
            message: signer.message,
            shortDescription: data.shortDescription || '',
            longDescription: data.description || '',
            rewardType: data.reward.type,
            rewardName: `${data.reward.amount} token pool`,
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
        uploadedImageUrl !== 'https://placehold.co/600x400'
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
        imageUrl !== 'https://placehold.co/600x400' &&
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
    if (step === 1)
      fieldsToValidate = [
        'title',
        'shortDescription',
        'description',
        'dates',
        'imageUrl',
      ]
    if (step === 2) fieldsToValidate = ['tasks']
    if (step === 3) fieldsToValidate = ['reward']

    const isValid = await form.trigger(fieldsToValidate as any)
    if (isValid) setStep((s) => s + 1)
  }

  const prevStep = () => setStep((s) => s - 1)

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
    setIsGenerating(true)
    setGenerationError(null)
    setGenerationStage('planning')
    // Hoist timer IDs so the finally block can always clear them
    let stageTimer1: ReturnType<typeof setTimeout> | undefined
    let stageTimer2: ReturnType<typeof setTimeout> | undefined
    try {
      // The server action handles all stages internally.
      // We simulate stage transitions based on typical timing.
      stageTimer1 = setTimeout(() => setGenerationStage('generating'), 8000)
      stageTimer2 = setTimeout(() => setGenerationStage('validating'), 25000)

      const result = await generateCampaign(aiPrompt)

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
      clearTimeout(stageTimer1)
      clearTimeout(stageTimer2)
      setIsGenerating(false)
      setGenerationStage(null)
    }
  }

  const steps = [
    { id: 1, name: 'Details' },
    { id: 2, name: 'Tasks' },
    { id: 3, name: 'Rewards' },
    { id: 4, name: 'Review' },
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
            <div className="mb-8 flex justify-center">
              <ol className="flex items-center w-full max-w-2xl">
                {steps.map((s, index) => (
                  <li
                    key={s.id}
                    className={cn('flex w-full items-center', {
                      "after:content-[''] after:w-full after:h-1 after:border-b after:border-border after:border-4 after:inline-block":
                        index !== steps.length - 1,
                    })}
                  >
                    <span
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0 font-bold',
                        step > s.id
                          ? 'bg-primary text-primary-foreground'
                          : step === s.id
                            ? 'bg-primary/20 border-2 border-primary text-primary'
                            : 'bg-secondary',
                      )}
                    >
                      {step > s.id ? <Check className="w-6 h-6" /> : s.id}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
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

                    {/* Generation stage progress */}
                    {isGenerating && generationStage && (
                      <div className="mt-4 p-4 rounded-lg bg-card border animate-in fade-in-50">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {generationStage === 'planning' &&
                                '🧠 Analyzing your project...'}
                              {generationStage === 'generating' &&
                                '✍️ Writing campaign content...'}
                              {generationStage === 'validating' &&
                                '🔍 Reviewing quality...'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {generationStage === 'planning' &&
                                'Deciding campaign strategy, target audience, and task types'}
                              {generationStage === 'generating' &&
                                'Crafting title, description, and tasks based on the plan'}
                              {generationStage === 'validating' &&
                                'Checking for quality, accuracy, and consistency'}
                            </p>
                          </div>
                        </div>
                        {/* Stage dots */}
                        <div className="flex items-center gap-2 mt-3">
                          {(
                            ['planning', 'generating', 'validating'] as const
                          ).map((stage, idx) => (
                            <React.Fragment key={stage}>
                              <div
                                className={cn(
                                  'h-2 w-2 rounded-full transition-colors duration-300',
                                  generationStage === stage
                                    ? 'bg-primary animate-pulse'
                                    : [
                                      'planning',
                                      'generating',
                                      'validating',
                                    ].indexOf(generationStage!) > idx
                                      ? 'bg-primary'
                                      : 'bg-muted',
                                )}
                              />
                              {idx < 2 && (
                                <div
                                  className={cn(
                                    'h-0.5 flex-1 rounded transition-colors duration-300',
                                    [
                                      'planning',
                                      'generating',
                                      'validating',
                                    ].indexOf(generationStage!) > idx
                                      ? 'bg-primary'
                                      : 'bg-muted',
                                  )}
                                />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            Plan
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Generate
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Validate
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Error display with retry */}
                    {generationError && !isGenerating && (
                      <div className="mt-4 p-4 rounded-lg border border-destructive/50 bg-destructive/5 animate-in fade-in-50">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {generationError.category === 'rate_limit' && (
                              <Clock className="h-5 w-5 text-muted-foreground" />
                            )}
                            {generationError.category === 'network' && (
                              <Wifi className="h-5 w-5 text-destructive" />
                            )}
                            {!['rate_limit', 'network'].includes(
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
                        onClick={() => setStep(1)}
                        disabled={isGenerating}
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
                  <h2 className="text-xl font-semibold border-b pb-2">
                    {steps[0].name}
                  </h2>
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="E.g., Awesome Project Token Launch"
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
                        <FormLabel>Short Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="A brief, catchy description for the campaign card."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detailed Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explain your campaign in detail for the main page."
                            rows={5}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dates"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Campaign Duration</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={'outline'}
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !field.value?.from && 'text-muted-foreground',
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value?.from ? (
                                  field.value.to ? (
                                    <>
                                      {format(
                                        field.value.from,
                                        'LLL dd, y HH:mm',
                                      )}{' '}
                                      -{' '}
                                      {format(
                                        field.value.to,
                                        'LLL dd, y HH:mm',
                                      )}
                                    </>
                                  ) : (
                                    format(field.value.from, 'LLL dd, y HH:mm')
                                  )
                                ) : (
                                  <span>Pick a date range</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="range"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                              numberOfMonths={2}
                            />
                            <div className="p-4 border-t grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="start-time-h">Start Time</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    id="start-time-h"
                                    min="0"
                                    max="23"
                                    className="w-16"
                                    placeholder="HH"
                                    value={dates?.from?.getHours() ?? 0}
                                    onChange={(e) => {
                                      const newHour = parseInt(
                                        e.target.value,
                                        10,
                                      )
                                      if (!isNaN(newHour))
                                        field.onChange({
                                          ...dates,
                                          from: setHours(
                                            dates.from ?? new Date(),
                                            newHour,
                                          ),
                                        })
                                    }}
                                  />
                                  <Input
                                    type="number"
                                    id="start-time-m"
                                    min="0"
                                    max="59"
                                    className="w-16"
                                    placeholder="MM"
                                    value={dates?.from?.getMinutes() ?? 0}
                                    onChange={(e) => {
                                      const newMin = parseInt(
                                        e.target.value,
                                        10,
                                      )
                                      if (!isNaN(newMin))
                                        field.onChange({
                                          ...dates,
                                          from: setMinutes(
                                            dates.from ?? new Date(),
                                            newMin,
                                          ),
                                        })
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="end-time-h">End Time</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    id="end-time-h"
                                    min="0"
                                    max="23"
                                    className="w-16"
                                    placeholder="HH"
                                    value={dates?.to?.getHours() ?? 0}
                                    onChange={(e) => {
                                      const newHour = parseInt(
                                        e.target.value,
                                        10,
                                      )
                                      if (!isNaN(newHour))
                                        field.onChange({
                                          ...dates,
                                          to: setHours(
                                            dates.to ?? new Date(),
                                            newHour,
                                          ),
                                        })
                                    }}
                                  />
                                  <Input
                                    type="number"
                                    id="end-time-m"
                                    min="0"
                                    max="59"
                                    className="w-16"
                                    placeholder="MM"
                                    value={dates?.to?.getMinutes() ?? 0}
                                    onChange={(e) => {
                                      const newMin = parseInt(
                                        e.target.value,
                                        10,
                                      )
                                      if (!isNaN(newMin))
                                        field.onChange({
                                          ...dates,
                                          to: setMinutes(
                                            dates.to ?? new Date(),
                                            newMin,
                                          ),
                                        })
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Image</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/image.png"
                            {...field}
                            value={uploadedImageUrl || field.value}
                            onChange={(e) => {
                              field.onChange(e)
                              setUploadedImageUrl(null)
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter an image URL or upload an image below.
                        </FormDescription>
                        <FormMessage />

                        {/* Image Upload Section */}
                        <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground mb-3">
                            Or upload an image (max 4MB):
                          </p>
                          <CampaignImageUpload
                            onUploadComplete={(url) => {
                              setUploadedImageUrl(url)
                              form.setValue('imageUrl', url)
                            }}
                          />
                          {uploadedImageUrl && (
                            <div className="mt-3 p-2 bg-status-claimable-bg border border-status-claimable-border rounded text-sm text-status-claimable-fg">
                              ✓ Image uploaded. You can change it after campaign
                              creation.
                            </div>
                          )}
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="humanityGated"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Humanity-verified participants only</FormLabel>
                          <FormDescription>
                            When enabled, the reward allocation is built only from wallets
                            that have completed Humanity Protocol verification — unverified
                            wallets get no allocation leaf and mathematically cannot claim
                            (tree-build filtering, not an on-chain check).
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </section>
              )}

              {step === 2 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <h2 className="text-xl font-semibold border-b pb-2">
                    {steps[1].name}
                  </h2>

                  {/* Discord Bot Warning - Show if Discord tasks exist but bot URL is not configured */}
                  {tasks.some((task) => task.type === 'JOIN_DISCORD') &&
                    !config.discordBotInviteUrl && (
                      <Alert variant="destructive">
                        <Bot className="h-4 w-4" />
                        <AlertTitle>Discord Bot Not Configured</AlertTitle>
                        <AlertDescription>
                          You have Discord join tasks but the bot invite URL is
                          not configured. Discord verification will not work
                          until the bot is properly set up. Please contact
                          support to configure the Discord bot.
                        </AlertDescription>
                      </Alert>
                    )}

                  {/* Telegram Bot Warning - Show if Telegram tasks exist but bot username is not configured */}
                  {tasks.some((task) => task.type === 'JOIN_TELEGRAM') &&
                    !config.telegramBotUsername && (
                      <Alert variant="destructive">
                        <Bot className="h-4 w-4" />
                        <AlertTitle>Telegram Bot Not Configured</AlertTitle>
                        <AlertDescription>
                          You have Telegram join tasks but the bot username is
                          not configured. Telegram verification will not work
                          until the bot is properly set up. Please contact
                          support to configure the Telegram bot.
                        </AlertDescription>
                      </Alert>
                    )}

                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex flex-col gap-4 p-4 border rounded-md"
                    >
                      <div className="flex gap-4 items-start">
                        <FormField
                          control={form.control}
                          name={`tasks.${index}.type`}
                          render={({ field }) => (
                            <FormItem className="w-1/3">
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
                                      {opt.label}
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
                            <FormItem className="flex-1">
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={`E.g., Follow @project on X`}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove Task</span>
                        </Button>
                      </div>

                      {tasks[index].type === 'JOIN_DISCORD' && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.verificationData`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Discord Server ID</FormLabel>
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
                                <FormLabel>Discord Invite Link</FormLabel>
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

                          {/* Discord Bot Setup Instructions */}
                          <div className="p-4 bg-secondary/40 border border-border rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-foreground">
                              <Bot className="h-5 w-5" />
                              <h4 className="font-semibold">
                                Required: Add DappDrop Bot to Your Server
                              </h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              To enable automatic verification of Discord join
                              tasks, you must add our bot to your Discord
                              server.
                            </p>
                            <div className="flex flex-col gap-2">
                              {config.discordBotInviteUrl ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-fit bg-background border-border text-foreground hover:bg-secondary"
                                  onClick={() =>
                                    window.open(
                                      config.discordBotInviteUrl!,
                                      '_blank',
                                    )
                                  }
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Add DappDrop Bot to Server
                                </Button>
                              ) : (
                                <p className="text-sm text-muted-foreground font-medium">
                                  Discord bot invite URL not configured. Please
                                  contact support.
                                </p>
                              )}
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>
                                  <strong>Required Permissions:</strong>
                                </p>
                                <ul className="list-disc list-inside ml-2 space-y-0.5">
                                  <li>View Server Members</li>
                                  <li>Read Message History</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {tasks[index].type === 'JOIN_TELEGRAM' && (
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.verificationData`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Telegram Channel/Group ID</FormLabel>
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
                                <FormLabel>Telegram Invite Link</FormLabel>
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

                          {/* Telegram Bot Setup Instructions */}
                          <div className="p-4 bg-secondary/40 border border-border rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-foreground">
                              <Bot className="h-5 w-5" />
                              <h4 className="font-semibold">
                                Required: Add DappDrop Bot to Your Channel/Group
                              </h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              To enable automatic verification of Telegram join
                              tasks, you must add our bot to your Telegram
                              channel/group.
                            </p>
                            <div className="flex flex-col gap-2">
                              {config.telegramBotUsername ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-fit bg-background border-border text-foreground hover:bg-secondary"
                                  onClick={() =>
                                    window.open(
                                      `https://t.me/${config.telegramBotUsername}`,
                                      '_blank',
                                    )
                                  }
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Add @{config.telegramBotUsername} to
                                  Channel/Group
                                </Button>
                              ) : (
                                <p className="text-sm text-muted-foreground font-medium">
                                  Telegram bot username not configured. Please
                                  contact support.
                                </p>
                              )}
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>
                                  <strong>Required Permissions:</strong>
                                </p>
                                <ul className="list-disc list-inside ml-2 space-y-0.5">
                                  <li>Read Messages</li>
                                  <li>See Members List (for groups)</li>
                                </ul>
                                <p className="mt-2">
                                  <strong>Note:</strong> For channels, make sure
                                  the bot is added as an admin. For groups, it
                                  can be a regular member.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {tasks[index].type === 'ONCHAIN_TX' && (
                        <div className="space-y-4">
                          {/* Beta Notice */}
                          <div className="flex items-center gap-2 p-3 bg-secondary/40 border border-border rounded-lg">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-foreground text-background">
                              BETA
                            </span>
                            <p className="text-sm text-muted-foreground">
                              On-chain actions (x402 Payment Protocol) are
                              currently in beta. Features may change.
                            </p>
                          </div>
                          <FormField
                            control={form.control}
                            name={`tasks.${index}.paymentRequired`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Payment Required</FormLabel>
                                  <FormDescription>
                                    Check this box if this task requires a
                                    crypto payment to complete
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />

                          {tasks[index].paymentRequired && (
                            <TooltipProvider>
                              <div className="space-y-3 p-5 bg-secondary/40 border border-border rounded-xl shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                                    💰 Payment Configuration
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
                                      <FormLabel className="text-sm font-medium text-foreground">
                                        Recipient Wallet
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

                                <div className="grid grid-cols-2 gap-3">
                                  <FormField
                                    control={form.control}
                                    name={`tasks.${index}.network`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium text-foreground">
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
                                              🔷 Ethereum
                                            </SelectItem>
                                            <SelectItem value="base">
                                              🔵 Base
                                            </SelectItem>
                                            <SelectItem value="polygon">
                                              🟣 Polygon
                                            </SelectItem>
                                            <SelectItem value="sepolia">
                                              🧪 Sepolia
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
                                        <FormLabel className="text-sm font-medium text-foreground">
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
                                      <FormLabel className="text-sm font-medium text-foreground flex items-center gap-2">
                                        Token Contract
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

                                <div className="grid grid-cols-2 gap-3">
                                  <FormField
                                    control={form.control}
                                    name={`tasks.${index}.amount`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium text-foreground flex items-center gap-1">
                                          Amount (ETH)
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-sm">
                                                Enter amount in ETH (e.g., 0.001
                                                ETH)
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
                                        <FormLabel className="text-sm font-medium text-foreground flex items-center gap-1">
                                          Display Format
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

                                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground bg-secondary px-3 py-2 rounded-md border border-border">
                                  <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span>
                                    Payments verified automatically via
                                    blockchain scan
                                  </span>
                                </div>
                              </div>
                            </TooltipProvider>
                          )}
                        </div>
                      )}

                      {tasks[index].type === 'HUMANITY_VERIFICATION' && (
                        <div className="space-y-4">
                          <div className="p-4 bg-secondary/50 border border-border rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-foreground">
                              <ShieldCheck className="h-5 w-5" />
                              <h4 className="font-semibold">
                                Verification Presets
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
                                      Required Checks ({selected.length}{' '}
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
                                                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked
                                                    ? 'border-foreground/40 bg-secondary/50 ring-1 ring-foreground/20'
                                                    : 'border-border hover:border-foreground/20 hover:bg-secondary/50'
                                                    }`}
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
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
                    <Plus className="mr-2 h-4 w-4" /> Add Task
                  </Button>
                </section>
              )}

              {step === 3 && (
                <section className="space-y-6 animate-in fade-in-50">
                  <h2 className="text-xl font-semibold border-b pb-2">
                    {steps[2].name}
                  </h2>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>ERC20 Merkle rewards only, for now</AlertTitle>
                    <AlertDescription>
                      NFT and off-chain rewards are coming in a later phase. This wizard
                      escrows an ERC20 token pool that is split among qualifying
                      participants after the campaign ends (equal split, per task
                      completion — see below).
                    </AlertDescription>
                  </Alert>
                  <FormField
                    control={form.control}
                    name="reward.type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Reward Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="ERC20" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                ERC20 Token (Fungible)
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="ERC721" disabled />
                              </FormControl>
                              <FormLabel className="font-normal text-muted-foreground">
                                ERC721 Token (NFT) — coming in a later phase
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="None" disabled />
                              </FormControl>
                              <FormLabel className="font-normal text-muted-foreground">
                                Other (Text description) — coming in a later phase
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {rewardType !== 'None' && (
                    <FormField
                      control={form.control}
                      name="reward.tokenAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Token Contract Address</FormLabel>
                          <FormControl>
                            <Input placeholder="0x..." {...field} />
                          </FormControl>
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
                          <FormLabel>Total Reward Pool</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="10000"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            The total token pool escrowed on-chain. After the campaign ends,
                            it is split equally among every wallet that completed all tasks
                            (equal-split policy — the default for this phase). Individual
                            wallet amounts are computed then, not now.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {rewardType === 'ERC20' && (
                    <FormField
                      control={form.control}
                      name="reward.settlementMode"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Settlement mode</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="MERKLE" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Merkle allocation — off-chain computed, 24h review window
                                  before claims open (default)
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="RANK_TIERED" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Rank-tiered — reward by completion order, computed entirely
                                  on-chain, no dispute window
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="SCORE_TIERED" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Score-tiered — reward by task-point score, computed entirely
                                  on-chain, no dispute window
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormDescription>
                            Tiered modes settle purely from on-chain completion state — no
                            host-published root, no dispute window, and the campaign still
                            settles completely even if you disappear after it ends.
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  )}
                  {rewardType === 'ERC20' && settlementMode === 'RANK_TIERED' && (
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Rank tiers</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            appendRankTier({ startRank: 1, endRank: 1, amount: '' })
                          }
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add tier
                        </Button>
                      </div>
                      {rankTierFields.map((f, i) => (
                        <div
                          key={f.id}
                          className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"
                        >
                          <FormField
                            control={form.control}
                            name={`reward.rankTiers.${i}.startRank`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">From rank</FormLabel>
                                <FormControl>
                                  <Input type="number" min={1} {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`reward.rankTiers.${i}.endRank`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">To rank</FormLabel>
                                <FormControl>
                                  <Input type="number" min={1} {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`reward.rankTiers.${i}.amount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Amount / wallet</FormLabel>
                                <FormControl>
                                  <Input placeholder="100" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRankTier(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {(form.formState.errors.reward as any)?.rankTiers?.message && (
                        <p className="text-sm font-medium text-destructive">
                          {(form.formState.errors.reward as any).rankTiers.message}
                        </p>
                      )}
                      {rankTiersWatched && rankTiersWatched.length > 0 && (
                        <div className="mt-3 rounded-md bg-secondary/40 p-3 text-sm space-y-1">
                          <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                            Payout preview
                          </p>
                          {rankTiersWatched.map((t, i) => (
                            <div key={i} className="flex justify-between">
                              <span>
                                Rank {t.startRank}–{t.endRank}
                              </span>
                              <span>{t.amount || '0'} tokens each</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {rewardType === 'ERC20' && settlementMode === 'SCORE_TIERED' && (
                    <div className="space-y-4">
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">Score tiers</h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => appendScoreTier({ minScore: 0, amount: '' })}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add tier
                          </Button>
                        </div>
                        {scoreTierFields.map((f, i) => (
                          <div
                            key={f.id}
                            className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
                          >
                            <FormField
                              control={form.control}
                              name={`reward.scoreTiers.${i}.minScore`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Minimum score</FormLabel>
                                  <FormControl>
                                    <Input type="number" min={0} {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`reward.scoreTiers.${i}.amount`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Amount / wallet</FormLabel>
                                  <FormControl>
                                    <Input placeholder="100" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeScoreTier(i)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {(form.formState.errors.reward as any)?.scoreTiers?.message && (
                          <p className="text-sm font-medium text-destructive">
                            {(form.formState.errors.reward as any).scoreTiers.message}
                          </p>
                        )}
                        {scoreTiersWatched && scoreTiersWatched.length > 0 && (
                          <div className="mt-3 rounded-md bg-secondary/40 p-3 text-sm space-y-1">
                            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                              Payout preview
                            </p>
                            {scoreTiersWatched.map((t, i) => (
                              <div key={i} className="flex justify-between">
                                <span>Score ≥ {t.minScore}</span>
                                <span>{t.amount || '0'} tokens</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 rounded-lg border p-4">
                        <h4 className="font-medium text-sm">Points per task</h4>
                        <FormDescription>
                          Assign how many points each task contributes to a participant&apos;s
                          score. A task not given any points doesn&apos;t affect scoring.
                        </FormDescription>
                        {tasks.map((t, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-muted-foreground truncate">
                              [{TASK_TYPE_OPTIONS.find((o) => o.value === t.type)?.label}]{' '}
                              {t.description || '(no description yet)'}
                            </span>
                            <FormField
                              control={form.control}
                              name={`reward.taskPoints.${i}`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input type="number" min={0} className="w-24" {...field} />
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
                  {rewardType === 'None' && (
                    <FormField
                      control={form.control}
                      name="reward.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reward Description</FormLabel>
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
                        <FormLabel>Participant Cap (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Leave blank for unlimited"
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
                  <h2 className="text-xl font-semibold border-b pb-2">
                    {steps[3].name} &amp; Create
                  </h2>
                  <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-6">
                    <h3 className="font-semibold text-lg">
                      {form.getValues('title')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {form.getValues('shortDescription')}
                    </p>
                    <div className="text-sm">
                      <strong>Reward pool:</strong>{' '}
                      {form.getValues('reward.amount')} tokens from{' '}
                      <code className="text-xs bg-muted p-1 rounded">
                        {form.getValues('reward.tokenAddress')}
                      </code>
                    </div>
                    <div className="text-sm">
                      <strong>Settlement:</strong>{' '}
                      {settlementMode === 'RANK_TIERED'
                        ? `Rank-tiered — on-chain, no dispute window (${(rankTiersWatched || []).length} tier(s) configured)`
                        : settlementMode === 'SCORE_TIERED'
                          ? `Score-tiered — on-chain, no dispute window (${(scoreTiersWatched || []).length} tier(s) configured)`
                          : 'Merkle allocation — equal split among wallets that complete every task'}
                      {humanityGatedWatched
                        ? settlementMode === 'MERKLE'
                          ? ' — Humanity-verified wallets only'
                          : ' — a required Humanity Verification task was added'
                        : ''}
                      .
                    </div>
                    {form.getValues('maxParticipants') && (
                      <div className="text-sm">
                        <strong>Participant cap:</strong>{' '}
                        {form.getValues('maxParticipants')}
                      </div>
                    )}
                    <div className="text-sm">
                      <strong>Tasks:</strong>
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        {form.getValues('tasks').map((task, i) => (
                          <li key={i}>
                            [
                            {
                              TASK_TYPE_OPTIONS.find(
                                (t) => t.value === task.type,
                              )?.label
                            }
                            ] {task.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* FR-H5: itemize the funding transaction before the host signs it. */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <h3 className="font-medium">Funding breakdown</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Gross debit
                      </span>
                      <span>
                        {form.getValues('reward.amount') || '0'} tokens
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Protocol fee {feeEnabled ? '' : '(disabled on this deployment)'}
                      </span>
                      <span>0 tokens</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t pt-2">
                      <span>Net escrowed</span>
                      <span>
                        {form.getValues('reward.amount') || '0'} tokens
                      </span>
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>What happens when you click Create</AlertTitle>
                    <AlertDescription>
                      This runs several wallet transactions in sequence: create
                      the campaign, add its tasks, configure the reward token,
                      approve and fund the pool
                      {form.getValues('maxParticipants')
                        ? ', and set the participant cap'
                        : ''}
                      . The campaign is created in Draft — you open it live in
                      a separate, final step.
                    </AlertDescription>
                  </Alert>
                </section>
              )}

              {step === 4 && wizardPhase === 'created' && createdCampaignId && (
                <GoLiveChecklist
                  campaignId={createdCampaignId}
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
                <div className="flex justify-between pt-4 mt-8 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={step === 1}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>

                  {step < 4 ? (
                    <Button type="button" onClick={nextStep}>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isLoading}>
                      {isLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {creationProgress || 'Create Campaign'}
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

/** FR-H6: hard-blocks Open until tasks exist AND the reward is configured+funded — both are
 * always true by the time this renders, since creation only reaches wizardPhase 'created'
 * after the full Draft+fund sequence succeeds. Opening is a separate, explicit action; a
 * completed Draft can sit indefinitely (FR-H7) via "I'll open it later". */
function GoLiveChecklist({
  campaignId,
  isOpening,
  onOpen,
  onLater,
}: {
  campaignId: string
  isOpening: boolean
  onOpen: () => void
  onLater: () => void
}) {
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
            <Check className="h-4 w-4 text-status-claimable-fg" /> Start/end times valid
          </li>
        </ul>
        <div className="flex gap-3 pt-2">
          <Button onClick={onOpen} disabled={isOpening}>
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
