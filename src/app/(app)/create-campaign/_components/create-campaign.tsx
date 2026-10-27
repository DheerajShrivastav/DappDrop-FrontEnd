'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Controller, FormProvider, useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BrowserProvider } from 'ethers'
import { resolveCampaignTiming, campaignTimingMessage } from '@/lib/campaign-timing'
import { OptionCards } from '@/components/option-cards'
import { RewardTokenStatus, tokenVerdict } from '@/components/reward-token-status'
import { NftTokenTable } from '@/components/nft-token-table'
import { TierSummary, type TierFooter } from '@/components/tier-summary'
import { CampaignImageUpload } from '@/components/campaign-image-upload'
import { useRewardTokenCheck } from '@/hooks/use-reward-token-check'
import {
  MAX_TIERS,
  formatTokenAmount,
  nextRankTier,
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
import { defaultScheduleState, scheduleSummary, scheduleToDates, type ScheduleState } from '@/lib/campaign-schedule'
import config from '@/app/config'
import {
  Button,
  CharCount,
  ErrorSummary,
  Field,
  InlineError,
  Input,
  KeyValueList,
  PageContainer,
  PageHeader,
  Panel,
  ScheduleField,
  Textarea,
  VerificationChip,
  WizardStepper,
  plural,
  stepEyebrow,
  type KeyValueItem,
} from '@/components/app'
import { useToast } from '@/hooks/use-toast'
import { getSession, signAuthMessage } from '@/lib/wallet-auth'
import { isSelfReportedTask, TASK_VERIFICATION_METHOD } from '@/lib/task-types'
import { normalizeRequiredText, normalizeXHandle, parseXPostUrl } from '@/lib/x-task-fields'
import { parseXTarget } from '@/lib/x-intents'
import type { TaskType } from '@/lib/types'
import {
  createDraftCampaignWithTasks,
  configureAndFundERC20Reward,
  setCampaignMaxParticipantsOnChain,
  getProtocolFeeBps,
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
import { generateCampaign } from '@/ai/flows/generate-campaign-flow'
import { parseCampaignGenerationError } from '@/ai/flows/generate-campaign.errors'
import { DEPLOYMENT_CHAIN } from '@/lib/deployment-chain'
import { claims } from '@/config/claims'
import { formatFeeBps, platformFeeLine } from '@/lib/protocol-fee'
import {
  CLIENT_GENERATION_GIVE_UP_MS,
  PLACEHOLDER_IMAGE_URL,
  STEP_FIELDS,
  campaignSchema,
  collectErrors,
  fieldId,
  isHttpUrl,
  newTask,
  parseIdList,
  taskSchema,
  taskTypeLabel,
  type CampaignFormValues,
} from './campaign-form'
import { AiDraftPanel, type GenerationError } from './ai-draft'
import { GoLiveChecklist } from './go-live'
import { HostGate, type HostGatePreview } from './host-gate'
import { TaskSummaryRow } from './task-summary-row'
import { RailPanels, WizardRail, WizardRailDisclosure } from './wizard-rail'
import { CheckRow, CopyableAddress, Notice, ReviewSection } from './wizard-ui'

// Step 2 only: the expanded task editor (type menu, Discord/Telegram/payment/Humanity/X fields)
// loads when the host reaches it, not with the route (keeps /create-campaign within its
// first-load budget once #45's X fields landed in it).
const TaskEditor = dynamic(() => import('./task-editor').then((m) => m.TaskEditor), {
  ssr: false,
  loading: () => <div className="h-[22rem] rounded-[10px] border border-rule-strong bg-surface" aria-hidden="true" />,
})

/**
 * /create-campaign: the host gate, then the campaign wizard (08-site phase 2, app-design §2.4–2.5).
 * Moved here from page.tsx (a page can't take props) so the dev fixture can render wallet-only
 * states. The create / fund / resume logic is the page's, unchanged; the view is Monolith.
 */

export type WizardWallet = {
  address: string | null
  isConnected: boolean
  role: 'host' | 'participant' | null
  checkRoles: (address: string) => Promise<void>
}

/** Initial state for the dev fixture (/_dev/create-campaign) only. Production never passes it. */
export type WizardFixture = {
  step?: number
  values?: Partial<CampaignFormValues>
  aiOpen?: boolean
  aiPrompt?: string
  generating?: boolean
  generationError?: GenerationError
  campaignCreated?: boolean
  pendingFunded?: boolean
  phase?: 'form' | 'created'
  createdCampaignId?: string
  submittedEndDate?: Date
  /** Press Continue once on mount (shows the inline errors and the summary). */
  continueOnMount?: boolean
  /** Collapse the first n tasks. */
  collapseFirst?: number
  gate?: HostGatePreview
  /** Preview the redeploy-coupled fee-cap note (app-design §3.3). */
  feeCapNote?: boolean
}

/** The redeployed Web3Campaigns caps any protocol fee at 10% (contracts PR #26; claims.feeCapEnforced). */
const FEE_CAP_SHIPPED = claims.feeCapEnforced

const STEPS = [
  { name: 'Details', hint: 'Name, schedule, image', title: 'Tell people what it is', lead: 'What participants see first: the name, the pitch, when it runs and a cover image.' },
  { name: 'Tasks', hint: 'What participants do', title: 'What should people do?', lead: 'Add the tasks that make a wallet eligible. Each task says how it’s checked, and participants see the same label.' },
  { name: 'Rewards', hint: 'What they receive', title: 'What do they get?', lead: 'What eligible wallets receive, and how it’s paid out. It’s escrowed when you create the campaign.' },
  { name: 'Review', hint: 'Check, then create', title: 'Check, then create', lead: 'Check everything before the campaign is created on-chain. It starts as a draft.' },
]

/** A section heading inside a step (an h2 under the step's h1). */
function StepSection({ title, help, id, children, className }: { title: string; help?: React.ReactNode; id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className} aria-labelledby={id}>
      <h2 id={id} className="text-[1.0625rem] font-semibold text-ink">
        {title}
      </h2>
      {help && <p className="mt-1 text-[0.8125rem] leading-snug text-ink-2">{help}</p>}
      <div className="mt-4 grid gap-5">{children}</div>
    </section>
  )
}

export function CreateCampaign({ wallet, fixture }: { wallet: WizardWallet; fixture?: WizardFixture }) {
  // Step 0 ("Generate with AI") is now a panel on Details, so the wizard opens on step 1.
  const [step, setStep] = useState(fixture?.step ?? 1)
  const [aiOpen, setAiOpen] = useState(fixture?.aiOpen ?? true)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(fixture?.generating ?? false)
  // Real elapsed time instead of fake stage timers: the client can't see which stage the
  // server is in, and a "Reviewing quality…" that never moves read as a hang.
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(fixture?.generating ? Date.now() - 12_000 : null)
  const [generationNow, setGenerationNow] = useState(() => Date.now())
  // Bumped on every start, cancel, skip and give-up. A response only applies if its id is still
  // current — so a late result can never overwrite a form the host has moved on from.
  const generationIdRef = useRef(0)
  const [generationError, setGenerationError] = useState<{
    message: string
    retryable: boolean
    category: string
  } | null>(fixture?.generationError ?? null)
  const [aiPrompt, setAiPrompt] = useState(fixture?.aiPrompt ?? '')
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [campaignCreated, setCampaignCreated] = useState(fixture?.campaignCreated ?? false)
  // v0.6.0 Draft flow: creation is a multi-tx sequence (createCampaign -> batchAddTasks ->
  // configureERC20Reward -> fund -> setMaxParticipants), always landing in Draft. Opening is
  // a SEPARATE, explicit action gated by the go-live checklist below (FR-H6).
  const [wizardPhase, setWizardPhase] = useState<'form' | 'created'>(fixture?.phase ?? 'form')
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(fixture?.createdCampaignId ?? null)
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
  const [submittedEndDate, setSubmittedEndDate] = useState<Date | null>(fixture?.submittedEndDate ?? null)
  const [pendingFunded, setPendingFunded] = useState(fixture?.pendingFunded ?? false)
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
  // The fee module's rate in bps (src/lib/protocol-fee.ts). Starts from the address book: with no
  // fee module configured it's 0 ("None during beta") until the live read says otherwise.
  const [feeBps, setFeeBps] = useState<number | null | undefined>(config.addresses.feeModule ? undefined : 0)
  const [isOpening, setIsOpening] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { address, isConnected, role, checkRoles } = wallet
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
          isOptional: true, // self-reported → optional by default
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
      ...fixture?.values,
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
      ? 'Ranked'
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
        title: 'Connect your wallet first',
        description: 'Connect the wallet you host with to create a campaign.',
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
    // Task settings (Discord server, Telegram chat, payment terms) are saved host-only, which
    // needs a wallet sign-in session. Check it BEFORE the first transaction: finding out after
    // the campaign exists would leave it with tasks nobody can verify.
    const sessionWallet = await getSession()
    if (!sessionWallet || sessionWallet.toLowerCase() !== address.toLowerCase()) {
      toast({
        variant: 'destructive',
        title: 'Sign in with your wallet first',
        description:
          'Reconnect your wallet and approve the sign-in message, then try again. Nothing was sent.',
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
          isOptional: t.isOptional ?? false,
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

      // Per-task off-chain metadata (Discord/Telegram/Humanity/payment) — still off-chain and
      // orthogonal to the v0.6.0 chain rewrite. The route is host-only and fetch() doesn't throw
      // on a 4xx, so refusals are collected and reported instead of disappearing into a log.
      const failedTaskSettings: number[] = []
      const postTaskMetadata = async (taskIndex: number, init: RequestInit) => {
        const res = await fetch('/api/campaign-task-metadata', init)
        if (!res.ok) {
          failedTaskSettings.push(taskIndex)
          console.warn(`Task ${taskIndex} settings were not saved (HTTP ${res.status})`)
        }
      }
      for (let i = 0; i < data.tasks.length; i++) {
        const task = data.tasks[i]
        try {
          if (task.type === 'JOIN_DISCORD' && task.discordInviteLink) {
            await postTaskMetadata(i, {
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
            await postTaskMetadata(i, {
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
            await postTaskMetadata(i, {
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
          } else if (
            task.type === 'SOCIAL_FOLLOW' ||
            task.type === 'SOCIAL_LIKE' ||
            task.type === 'RETWEET' ||
            task.type === 'SOCIAL_POST'
          ) {
            // X task fields (#45). Normalised here; re-validated wherever they're used (intent
            // links, proof-by-post).
            const post = parseXPostUrl(task.xPostUrl)
            const metadata =
              task.type === 'SOCIAL_FOLLOW'
                ? { xHandle: normalizeXHandle(task.xHandle) }
                : task.type === 'SOCIAL_POST'
                  ? { xRequiredText: normalizeRequiredText(task.xRequiredText) }
                  : { xPostId: post?.id ?? null, xPostUrl: post?.url ?? null }
            await postTaskMetadata(i, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ campaignId: Number(campaignId), taskIndex: i, taskType: task.type, metadata }),
            })
          } else if (task.type === 'ONCHAIN_TX' && task.paymentRequired) {
            await postTaskMetadata(i, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId: Number(campaignId),
                taskIndex: i,
                taskType: task.type,
                metadata: {
                  paymentRequired: true,
                  paymentRecipient: task.paymentRecipient,
                  // Always the deployment chain (never a form value), so a Sepolia
                  // app can't save a mainnet payment task.
                  chainId: DEPLOYMENT_CHAIN.id,
                  network: DEPLOYMENT_CHAIN.network,
                  tokenAddress: task.tokenAddress || null,
                  tokenSymbol: task.tokenSymbol,
                  amount: task.amount,
                  amountDisplay: task.amountDisplay,
                },
              }),
            })
          }
        } catch (e) {
          failedTaskSettings.push(i)
          console.warn(`Failed to store metadata for task ${i}:`, e)
        }
      }

      // Metadata for the auto-injected HUMANITY_VERIFICATION task (if any) — it's appended
      // after every form-entered task, so its on-chain index is data.tasks.length. Defaults to
      // the 'is_human' preset since the host never configured one for a task they didn't add.
      if (needsAutoHumanityTask) {
        try {
          await postTaskMetadata(data.tasks.length, {
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
          failedTaskSettings.push(data.tasks.length)
          console.warn('Failed to store metadata for auto-injected humanity task:', e)
        }
      }
      if (failedTaskSettings.length > 0) {
        toast({
          variant: 'destructive',
          title: "Some task settings weren't saved",
          description: `Task ${failedTaskSettings.map((n) => n + 1).join(', ')} couldn't be configured, so participants can't verify ${failedTaskSettings.length === 1 ? 'it' : 'them'}. Don't open the campaign yet — contact support.`,
          duration: 15000,
        })
      }

      setCreatedCampaignId(campaignId)
      setWizardPhase('created')
      setCreationProgress(null)
      toast({
        title: 'Campaign created',
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
    if (wizardPhase === 'form') {
      getProtocolFeeBps().then((bps) => {
        setFeeBps(bps)
        // null = a module is set but unreadable: still a fee, so Review says it couldn't read it.
        setFeeEnabled(bps !== 0)
      })
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
    if (!isValid) {
      // 08-site: errors show inline; with 2 or more, a summary at the top links to each field.
      const errs = collectErrors(form.formState.errors as Record<string, unknown>, STEP_FIELDS[step] ?? [])
      if (step === 2) {
        const taskErrors = (form.formState.errors.tasks ?? []) as unknown[]
        setCollapsedTasks((c) => {
          const next = { ...c }
          fields.forEach((f, i) => {
            if (taskErrors[i]) delete next[f.id]
          })
          return next
        })
      }
      setSummaryFor(step)
      setTimeout(() => {
        if (errs.length > 1) summaryRef.current?.focus()
        else if (errs[0]) document.getElementById(errs[0].id)?.focus()
      }, 50)
      return
    }
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
        title: 'Describe your project first',
        description: 'Write a short description of your project.',
      })
      return
    }
    if (aiPrompt.trim().length < 20) {
      toast({
        variant: 'destructive',
        title: 'That description is too short',
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
        // AI tasks get the same default as hand-added ones: self-reported → optional.
        tasks: result.tasks.map((t) => {
          // Prefill X fields from the AI's wording when it names a handle / post (#45; the host
          // can edit them).
          const target = parseXTarget(t.description)
          return {
            ...t,
            isOptional: isSelfReportedTask(t.type),
            xHandle: target.handle ? `@${target.handle}` : undefined,
            xPostUrl: target.handle && target.tweetId ? `https://x.com/${target.handle}/status/${target.tweetId}` : undefined,
          }
        }),
      })
      toast({
        title: 'Draft ready',
        description: 'Check the name, descriptions and tasks, and change anything you like.',
      })
      setStep(1)
      setAiOpen(false)
    } catch (e: any) {
      if (!isCurrent()) return
      console.error('Error generating campaign:', e)

      let errorTitle = 'The draft didn’t work'
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
            errorTitle = 'The AI service is busy'
            break
          case 'timeout':
            errorTitle = 'That took too long'
            break
          case 'config':
            errorTitle = 'AI drafting isn’t set up'
            break
          case 'network':
            errorTitle = 'We couldn’t reach the AI service'
            break
          case 'validation':
            errorTitle = 'Check your description'
            break
          case 'api_error':
            errorTitle = 'The AI service had a problem'
            break
          default:
            errorTitle = 'The draft didn’t work'
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

  // ---------------------------------------------------------------------------------------------
  // View state (08-site phase 2). Declared before the gate's early return, like every hook above.
  // ---------------------------------------------------------------------------------------------
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, true>>({})
  const [summaryFor, setSummaryFor] = useState<number | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const firstStepRender = useRef(true)
  useEffect(() => {
    // A new step starts at the top of the page (the stepper and the step's question).
    if (firstStepRender.current) {
      firstStepRender.current = false
      return
    }
    window.scrollTo({ top: 0 })
  }, [step, wizardPhase])
  useEffect(() => {
    if (!fixture) return
    if (fixture.collapseFirst) {
      setCollapsedTasks(Object.fromEntries(fields.slice(0, fixture.collapseFirst).map((f) => [f.id, true as const])))
    }
    if (fixture.continueOnMount) nextStep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (fixture?.gate || role !== 'host') {
    return (
      <HostGate
        isConnected={isConnected}
        address={address}
        checking={isConnected && role === null}
        onGranted={() => (address ? checkRoles(address) : undefined)}
        preview={fixture?.gate}
      />
    )
  }

  const created = step === 4 && wizardPhase === 'created' && !!createdCampaignId
  const meta = created
    ? { title: 'Your campaign is a draft.', lead: 'Open it now, or later from your dashboard.' }
    : STEPS[step - 1]
  const summaryErrors = summaryFor === step ? collectErrors(form.formState.errors as Record<string, unknown>, STEP_FIELDS[step] ?? []) : []
  const errors = form.formState.errors
  const rewardErrors = (errors.reward ?? {}) as Record<string, { message?: string } | undefined>

  // --- The rail -------------------------------------------------------------------------------
  const title = form.watch('title')
  const selfReportedCount = tasks.filter((t) => isSelfReportedTask(t.type)).length
  const nftCount = parseIdList(form.watch('reward.tokenIds') || '').length
  const rewardSoFar =
    step < 3
      ? 'Next step'
      : rewardType === 'ERC20'
        ? rewardAmount
          ? `${rewardAmount} ${rewardToken ? tokenSymbol : ''}`.trim()
          : 'Not set yet'
        : rewardType === 'ERC721'
          ? `${plural(nftCount, 'NFT')}`
          : 'Not set yet'
  const soFar: KeyValueItem[] = [
    { label: 'Name', value: <span className="font-sans text-[0.875rem]">{title?.trim() || '—'}</span> },
    {
      label: 'Runs',
      value: `${schedule.startMode === 'now' ? 'From creation' : 'Scheduled'} · ${schedule.preset === 'custom' ? 'custom end' : plural(schedule.preset, 'day')}`,
    },
    { label: 'Tasks', value: `${tasks.length}${selfReportedCount ? ` · ${selfReportedCount} self-reported` : ''}` },
    { label: 'Reward', value: <span className={step < 3 ? 'text-ink-3' : undefined}>{rewardSoFar}</span> },
  ]
  if (step >= 3 && rewardType !== 'None') soFar.push({ label: 'Payout', value: rewardType === 'ERC721' ? 'One NFT each' : payoutLabel })
  const gas = { label: 'Network gas', value: `Yours, in ${DEPLOYMENT_CHAIN.gasSymbol}` }
  // app-design §3.3: "{x}% · the contract caps it at 10%" with a fee module set, else "None during beta".
  const feeWords = (f: string) => {
    if (f === 'None') return feeEnabled ? 'None' : 'None during beta'
    // An amount ("25 EXAMPLE") gets its rate; "Calculating…", "Couldn’t read" and "—" stay as they are.
    return typeof feeBps === 'number' && feeBps > 0 && /\d/.test(f) ? `${f} · ${formatFeeBps(feeBps)}` : f
  }
  const payNow: KeyValueItem[] = [{ label: 'Platform fee', value: platformFeeLine(feeBps, FEE_CAP_SHIPPED) }, gas]
  const payReview: KeyValueItem[] =
    rewardType === 'ERC20'
      ? [
          { label: 'Taken from your wallet', value: funding.gross },
          { label: 'Platform fee', value: feeWords(funding.fee) },
          { label: <span className="font-semibold text-ink">Escrowed for rewards</span>, value: <span className="font-semibold">{funding.net}</span> },
          gas,
        ]
      : [{ label: 'NFTs to deposit', value: `${nftCount} × ${nftStandard}` }, gas]
  const rail = step === 4 ? { pay: payReview, payNote: rewardType === 'ERC20' ? funding.note : null } : { soFar, pay: payNow }
  const feeCapNote = FEE_CAP_SHIPPED || !!fixture?.feeCapNote

  const goTo = (s: number) => setStep(s)
  const addTask = () => {
    // Finished tasks fold into one line each (mockup wizard.html); incomplete ones stay open.
    setCollapsedTasks((c) => {
      const next = { ...c }
      fields.forEach((f, i) => {
        if (taskSchema.safeParse(tasks[i]).success) next[f.id] = true
      })
      return next
    })
    append(newTask())
  }

  return (
    <PageContainer>
      <PageHeader
        size="md"
        eyebrow={
          <>
            New campaign · <b className="font-normal text-signal">{created ? 'Created' : stepEyebrow(step - 1, STEPS.length)}</b>
          </>
        }
        title={meta.title}
        lead={meta.lead}
      />

      {created ? (
        <div className="mt-10">
          <GoLiveChecklist
            campaignId={createdCampaignId!}
            endDate={submittedEndDate ?? undefined}
            isOpening={isOpening}
            onOpen={async () => {
              if (fixture) return
              setIsOpening(true)
              try {
                await openCampaign(createdCampaignId!, toast)
                router.push(`/campaign/${createdCampaignId}`)
              } catch {
                // Error toast already shown by openCampaign.
              } finally {
                setIsOpening(false)
              }
            }}
            onLater={() => (fixture ? undefined : router.push(`/campaign/${createdCampaignId}`))}
          />
        </div>
      ) : (
        <>
          <WizardStepper
            className="mt-10"
            current={step - 1}
            steps={STEPS.map((s, i) => ({
              name: s.name,
              hint: s.hint,
              // Done steps link back, except those already fixed on-chain (see minStep).
              onSelect: i + 1 >= minStep && i + 1 < step ? () => goTo(i + 1) : undefined,
            }))}
          />
          <FormProvider {...form}>
            <div className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <form onSubmit={fixture ? (e) => e.preventDefault() : form.handleSubmit(onSubmit)} noValidate className="grid min-w-0 grid-cols-1 gap-8" aria-label={`Step ${step}: ${STEPS[step - 1].name}`}>
                <ErrorSummary ref={summaryRef} errors={summaryErrors} focusOnMount={false} />

                {step === 1 && (
                  <>
                    {!campaignCreated && (
                      <AiDraftPanel
                        open={aiOpen}
                        onOpen={() => setAiOpen(true)}
                        prompt={aiPrompt}
                        onPromptChange={(v) => {
                          setAiPrompt(v)
                          if (generationError) setGenerationError(null)
                        }}
                        isGenerating={isGenerating}
                        seconds={generationSeconds}
                        error={generationError}
                        onGenerate={handleGenerate}
                        onCancel={cancelGeneration}
                        onSkip={() => {
                          // Skipping mid-generation stops waiting, so a late result can't overwrite what they type.
                          if (isGenerating) cancelGeneration()
                          setAiOpen(false)
                        }}
                      />
                    )}
                    <Controller
                      control={form.control}
                      name="title"
                      render={({ field, fieldState }) => (
                        <Field id={fieldId('title')} label="Campaign name" error={fieldState.error?.message} count={<CharCount value={field.value ?? ''} min={5} />}>
                          {(p) => <Input {...p} placeholder="e.g. Testnet launch quest" {...field} />}
                        </Field>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="shortDescription"
                      render={({ field, fieldState }) => (
                        <Field id={fieldId('shortDescription')} label="Short description" help="Shown on the campaign card in the list." error={fieldState.error?.message} count={<CharCount value={field.value ?? ''} min={10} />}>
                          {(p) => <Textarea {...p} placeholder="One or two sentences that make people want to join." rows={2} className="min-h-0 resize-none" {...field} />}
                        </Field>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="description"
                      render={({ field, fieldState }) => (
                        <Field id={fieldId('description')} label="Detailed description" help="Shown on the campaign page." error={fieldState.error?.message} count={<CharCount value={field.value ?? ''} min={50} />}>
                          {(p) => <Textarea {...p} placeholder="Explain the project, why people should take part, and what they get for it." rows={6} {...field} />}
                        </Field>
                      )}
                    />
                    <div id={fieldId('dates')} tabIndex={-1} role="group" aria-labelledby="schedule-h" className="grid gap-[0.45rem] outline-none">
                      <p id="schedule-h" className="text-[0.9375rem] font-semibold text-ink">
                        Schedule
                      </p>
                      <p className="-mt-0.5 mb-1 text-[0.8125rem] leading-snug text-ink-2">
                        Times are in your local time zone. Campaigns run between 1 hour and 365 days, and the start and end can’t be changed after creation.
                      </p>
                      <ScheduleField value={schedule} onChange={applySchedule} />
                      {/* The schema's issue sits on `dates` itself (no path). */}
                      {(errors.dates as { message?: string } | undefined)?.message && <InlineError>{(errors.dates as { message?: string }).message}</InlineError>}
                    </div>
                    <Controller
                      control={form.control}
                      name="imageUrl"
                      render={({ field, fieldState }) => (
                        <Field
                          id={fieldId('imageUrl')}
                          label="Cover image"
                          optional
                          help="Shown on the campaign card and page. Upload one, or paste a link to an image. You can change it after the campaign is created."
                          error={fieldState.error?.message}
                        >
                          {(p) => (
                            <div className="grid gap-3">
                              {/* The placeholder is the form's "no image" value, so it renders as the empty dropzone. */}
                              <CampaignImageUpload
                                value={uploadedImageUrl || (field.value !== PLACEHOLDER_IMAGE_URL && isHttpUrl(field.value) ? field.value : null)}
                                onUploadComplete={(url) => {
                                  setUploadedImageUrl(url)
                                  form.setValue('imageUrl', url, { shouldValidate: true })
                                }}
                                onRemove={() => {
                                  setUploadedImageUrl(null)
                                  form.setValue('imageUrl', PLACEHOLDER_IMAGE_URL, { shouldValidate: true })
                                }}
                              />
                              <Input
                                {...p}
                                placeholder="Or paste an image URL"
                                {...field}
                                value={uploadedImageUrl || (field.value === PLACEHOLDER_IMAGE_URL ? '' : field.value)}
                                onChange={(e) => {
                                  // Clearing the input means "no image", not an invalid URL.
                                  field.onChange(e.target.value.trim() || PLACEHOLDER_IMAGE_URL)
                                  setUploadedImageUrl(null)
                                }}
                              />
                            </div>
                          )}
                        </Field>
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="humanityGated"
                      render={({ field }) => (
                        <CheckRow
                          id={fieldId('humanityGated')}
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                          label={
                            <>
                              Verified humans only <span className="ml-1.5 text-[0.8125rem] text-ink-3">Optional; off by default</span>
                            </>
                          }
                          description="Only wallets verified with Humanity Protocol can claim. Unverified wallets are left out when the reward list is built, so bots and duplicate wallets can’t claim."
                        />
                      )}
                    />
                  </>
                )}

                {step === 2 && (
                  <>
                    {tasks.length > 0 && tasks.every((t) => isSelfReportedTask(t.type)) && (
                      <Notice>Every task is self-reported. Add a checked task (Discord, Telegram or a verified-human check) to keep bots out.</Notice>
                    )}
                    <div className="grid gap-5">
                      {(() => {
                        // Consecutive collapsed tasks share one panel (mockup wizard.html).
                        const out: React.ReactNode[] = []
                        let run: React.ReactNode[] = []
                        const flush = (key: string) => {
                          if (run.length) out.push(<Panel key={`run-${key}`} pad={false}>{run}</Panel>)
                          run = []
                        }
                        fields.forEach((f, i) => {
                          if (collapsedTasks[f.id]) {
                            run.push(<TaskSummaryRow key={f.id} index={i} onEdit={() => setCollapsedTasks(({ [f.id]: _, ...rest }) => rest)} />)
                          } else {
                            flush(f.id)
                            out.push(
                              <TaskEditor
                                key={f.id}
                                index={i}
                                canRemove={fields.length > 1}
                                onRemove={() => remove(i)}
                                onDone={
                                  fields.length > 1
                                    ? async () => {
                                        if (await form.trigger(`tasks.${i}`)) setCollapsedTasks((c) => ({ ...c, [f.id]: true }))
                                      }
                                    : undefined
                                }
                              />,
                            )
                          }
                        })
                        flush('end')
                        return out
                      })()}
                    </div>
                    <Button variant="secondary" className="justify-self-start" onClick={addTask}>
                      + Add a task <span className="font-mono text-[0.8125rem] text-ink-3">· {fields.length} so far</span>
                    </Button>
                  </>
                )}

                {step === 3 && (
                  <>
                    {rewardLocked ? (
                      <Panel tone="outline" eyebrow="Funded on-chain · locked">
                        <p className="text-[0.875rem] text-ink-2">
                          The reward can’t be changed now.
                          {tiersEditable ? ' You can still fix the tiers below, then finish setup on the Review step.' : ' Finish setup on the Review step.'}
                        </p>
                        <KeyValueList
                          className="mt-3"
                          items={[
                            {
                              label: rewardType === 'ERC20' ? 'Pool' : 'Items',
                              value:
                                rewardType === 'ERC20'
                                  ? `${Number.isFinite(Number(rewardAmount)) ? Number(rewardAmount).toLocaleString(undefined, { maximumFractionDigits: 18 }) : rewardAmount} ${tokenSymbol}`
                                  : `${parseIdList(form.getValues('reward.tokenIds') || '').length} × ${nftStandard}`,
                            },
                            { label: rewardType === 'ERC20' ? 'Token' : 'Collection', value: <CopyableAddress address={fundedReward?.tokenAddress ?? rewardTokenAddress ?? ''} /> },
                            ...(rewardType === 'ERC20' ? [{ label: 'Payout', value: payoutLabel }] : []),
                          ]}
                        />
                      </Panel>
                    ) : (
                      <>
                        <Controller
                          control={form.control}
                          name="reward.type"
                          render={({ field }) => (
                            <StepSection id="reward-type-h" title="What kind of reward?" help="Rewards are escrowed when the campaign is created and paid out after it ends.">
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
                            </StepSection>
                          )}
                        />
                        {rewardType === 'ERC721' && (
                          <Controller
                            control={form.control}
                            name="reward.nftStandard"
                            render={({ field }) => (
                              <StepSection id="nft-std-h" title="NFT standard">
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
                              </StepSection>
                            )}
                          />
                        )}
                        {rewardType !== 'None' && (
                          <Controller
                            control={form.control}
                            name="reward.tokenAddress"
                            render={({ field, fieldState }) => (
                              <div className="grid gap-2">
                                <Field id={fieldId('reward.tokenAddress')} label={rewardType === 'ERC20' ? 'Token contract address' : 'NFT contract address'} error={fieldState.error?.message}>
                                  {(p) => <Input {...p} placeholder="0x…" className="font-mono text-[0.875rem]" autoComplete="off" spellCheck={false} {...field} value={field.value === '0x' ? '' : field.value} />}
                                </Field>
                                {/* Pre-flight: is it a contract on this network, the right kind, and do you hold enough, before any transaction. */}
                                <RewardTokenStatus verdict={tokenStatus} />
                              </div>
                            )}
                          />
                        )}
                        {rewardType === 'ERC20' && (
                          <Controller
                            control={form.control}
                            name="reward.amount"
                            render={({ field, fieldState }) => (
                              <Field
                                id={fieldId('reward.amount')}
                                label="Total reward pool"
                                help={`The total escrowed on-chain when you create the campaign.${settlementMode === 'MERKLE' ? ' After it ends, it’s split equally among every wallet that finished every task.' : ' Paid out by the tiers below.'}`}
                                error={fieldState.error?.message}
                              >
                                {(p) => (
                                  <div className="relative">
                                    {/* Text + inputMode, not type="number": a number box changes value when the page scrolls over it and accepts "1e5". */}
                                    <Input {...p} inputMode="decimal" autoComplete="off" placeholder="10000" className={rewardToken ? 'pr-20 font-mono' : 'font-mono'} {...field} />
                                    {rewardToken && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-mono text-[0.8125rem] text-ink-2">{rewardToken.symbol}</span>}
                                  </div>
                                )}
                              </Field>
                            )}
                          />
                        )}
                      </>
                    )}

                    {!rewardLocked && settlementLocked && rewardType === 'ERC20' && (
                      <Notice>
                        <span className="font-semibold text-ink">Payout: {payoutLabel}.</span> Set when the campaign was created on-chain, so it can’t be changed now.
                      </Notice>
                    )}
                    {rewardType === 'ERC20' && !settlementLocked && (
                      <Controller
                        control={form.control}
                        name="reward.settlementMode"
                        render={({ field }) => (
                          <StepSection id="payout-h" title="How the pool is paid out">
                            <OptionCards
                              ariaLabel="How the pool is paid out"
                              value={field.value ?? 'MERKLE'}
                              onChange={field.onChange}
                              options={[
                                {
                                  value: 'MERKLE',
                                  title: 'Equal split',
                                  description: 'Every wallet that finishes every task gets the same share. You publish the reward list after the end; claims open 24 hours later.',
                                  hint: 'Best for simple, fair drops',
                                },
                                {
                                  value: 'RANK_TIERED',
                                  title: 'Ranked',
                                  description: 'Paid by finishing order, e.g. the first 10 wallets get 100 each. Worked out on-chain; claims open as soon as the campaign ends.',
                                  hint: 'Best for races and early-bird rewards',
                                },
                                {
                                  value: 'SCORE_TIERED',
                                  title: 'By points',
                                  description: 'Each task is worth points; a wallet is paid by the tier its score reaches. Worked out on-chain; claims open as soon as the campaign ends.',
                                  hint: 'Best for rewarding deeper engagement',
                                },
                              ]}
                            />
                          </StepSection>
                        )}
                      />
                    )}

                    {rewardType === 'ERC20' && settlementMode === 'RANK_TIERED' && !pendingTiersSet && (
                      <div id={fieldId('reward.rankTiers')} tabIndex={-1} className="grid gap-4 rounded-[10px] border border-rule-strong p-5 outline-none">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="text-[1.0625rem] font-semibold text-ink">Rank tiers</h2>
                            <p className="mt-1 text-[0.8125rem] text-ink-2">Rank 1 is the first wallet to finish every task. Up to {MAX_TIERS} tiers.</p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={(rankTiersWatched?.length ?? 0) >= MAX_TIERS}
                            disabledReason={`Up to ${MAX_TIERS} tiers.`}
                            // Continues right after the highest rank already covered, so tiers never overlap by default.
                            onClick={() => appendRankTier(nextRankTier(rankTiersWatched || []))}
                          >
                            + Add a tier
                          </Button>
                        </div>
                        {rankTierFields.length > 0 && (
                          <div aria-hidden="true" className="hidden grid-cols-[1fr_1fr_1.4fr_5rem] gap-3 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-ink-3 sm:grid">
                            <span>From rank</span>
                            <span>To rank</span>
                            <span>{rewardToken ? `${rewardToken.symbol} each` : 'Amount each'}</span>
                          </div>
                        )}
                        {rankTierFields.map((f, i) => (
                          <div key={f.id} className="grid grid-cols-2 items-end gap-3 border-b border-rule pb-4 last:border-b-0 sm:grid-cols-[1fr_1fr_1.4fr_5rem] sm:border-b-0 sm:pb-0">
                            {(
                              [
                                ['startRank', 'From rank', 'numeric', undefined],
                                ['endRank', 'To rank', 'numeric', undefined],
                                ['amount', rewardToken ? `${rewardToken.symbol} each` : 'Amount each', 'decimal', '100'],
                              ] as const
                            ).map(([key, label, mode, ph]) => (
                              <Controller
                                key={key}
                                control={form.control}
                                name={`reward.rankTiers.${i}.${key}`}
                                render={({ field, fieldState }) => (
                                  <label className="grid gap-1.5">
                                    <span className="text-[0.8125rem] text-ink-2 sm:sr-only">
                                      {label}
                                      <span className="sr-only">, tier {i + 1}</span>
                                    </span>
                                    <Input id={fieldId(`reward.rankTiers.${i}.${key}`)} inputMode={mode} placeholder={ph} aria-invalid={fieldState.error ? true : undefined} className="font-mono" {...field} />
                                  </label>
                                )}
                              />
                            ))}
                            <button type="button" className="dd-link min-h-12 justify-self-start text-small text-ink sm:justify-self-end" aria-label={`Remove tier ${i + 1}`} onClick={() => removeRankTier(i)}>
                              Remove
                            </button>
                          </div>
                        ))}
                        <TierSummary
                          problem={rankTiersWatched?.length ? rankTierProblem(rankTiersWatched) : null}
                          schemaMessage={rewardErrors.rankTiers?.message}
                          rows={sortRankTiers(rankTiersWatched || []).map((t) => ({
                            label: Number(t.startRank) === Number(t.endRank) ? `Rank ${t.startRank}` : `Ranks ${t.startRank}–${t.endRank}`,
                            value: `${t.amount || '0'} ${tokenSymbol} each`,
                          }))}
                          footer={rankPayoutFooter}
                        />
                      </div>
                    )}

                    {rewardType === 'ERC20' && settlementMode === 'SCORE_TIERED' && !pendingTiersSet && (
                      <>
                        <div id={fieldId('reward.scoreTiers')} tabIndex={-1} className="grid gap-4 rounded-[10px] border border-rule-strong p-5 outline-none">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h2 className="text-[1.0625rem] font-semibold text-ink">Score tiers</h2>
                              <p className="mt-1 text-[0.8125rem] text-ink-2">A wallet is paid by the highest tier its score reaches. Any order is fine.</p>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={(scoreTiersWatched?.length ?? 0) >= MAX_TIERS}
                              disabledReason={`Up to ${MAX_TIERS} tiers.`}
                              onClick={() =>
                                appendScoreTier({
                                  // A fresh minimum above every existing one, so two tiers never start with the same threshold.
                                  minScore: (scoreTiersWatched || []).reduce((m, t) => Math.max(m, Number(t.minScore) + 1 || 0), 0),
                                  amount: '',
                                })
                              }
                            >
                              + Add a tier
                            </Button>
                          </div>
                          {scoreTierFields.length > 0 && (
                            <div aria-hidden="true" className="hidden grid-cols-[1fr_1.4fr_5rem] gap-3 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-ink-3 sm:grid">
                              <span>Minimum score</span>
                              <span>{rewardToken ? `${rewardToken.symbol} per wallet` : 'Amount per wallet'}</span>
                            </div>
                          )}
                          {scoreTierFields.map((f, i) => (
                            <div key={f.id} className="grid grid-cols-2 items-end gap-3 border-b border-rule pb-4 last:border-b-0 sm:grid-cols-[1fr_1.4fr_5rem] sm:border-b-0 sm:pb-0">
                              {(
                                [
                                  ['minScore', 'Minimum score', 'numeric', undefined],
                                  ['amount', rewardToken ? `${rewardToken.symbol} per wallet` : 'Amount per wallet', 'decimal', '100'],
                                ] as const
                              ).map(([key, label, mode, ph]) => (
                                <Controller
                                  key={key}
                                  control={form.control}
                                  name={`reward.scoreTiers.${i}.${key}`}
                                  render={({ field, fieldState }) => (
                                    <label className="grid gap-1.5">
                                      <span className="text-[0.8125rem] text-ink-2 sm:sr-only">
                                        {label}
                                        <span className="sr-only">, tier {i + 1}</span>
                                      </span>
                                      <Input id={fieldId(`reward.scoreTiers.${i}.${key}`)} inputMode={mode} placeholder={ph} aria-invalid={fieldState.error ? true : undefined} className="font-mono" {...field} />
                                    </label>
                                  )}
                                />
                              ))}
                              <button type="button" className="dd-link col-span-2 min-h-12 justify-self-start text-small text-ink sm:col-span-1 sm:justify-self-end" aria-label={`Remove tier ${i + 1}`} onClick={() => removeScoreTier(i)}>
                                Remove
                              </button>
                            </div>
                          ))}
                          <TierSummary
                            problem={scoreTiersWatched?.length ? scoreTierProblem(scoreTiersWatched) : null}
                            schemaMessage={rewardErrors.scoreTiers?.message}
                            rows={sortScoreTiers(scoreTiersWatched || []).map((t) => ({ label: `Score ${t.minScore}+`, value: `${t.amount || '0'} ${tokenSymbol}` }))}
                            footer={scorePayoutFooter}
                          />
                        </div>
                        <div id={fieldId('reward.taskPoints')} tabIndex={-1} className="grid gap-3 rounded-[10px] border border-rule-strong p-5 outline-none">
                          <div>
                            <h2 className="text-[1.0625rem] font-semibold text-ink">Points per task</h2>
                            <p className="mt-1 text-[0.8125rem] text-ink-2">How many points each task adds to a wallet’s score. A task with 0 points doesn’t affect scoring.</p>
                          </div>
                          {tasks.map((t, i) => (
                            <div key={i} className="grid gap-1.5 border-t border-rule pt-3">
                              <div className="flex items-center justify-between gap-3">
                                <label htmlFor={fieldId(`reward.taskPoints.${i}`)} className="min-w-0 text-[0.875rem] text-ink">
                                  <span className="font-mono text-[0.75rem] text-ink-3">{String(i + 1).padStart(2, '0')}</span> {t.description || '(no description yet)'}
                                  <span className="block text-[0.8125rem] text-ink-2">{taskTypeLabel(t.type)}</span>
                                </label>
                                <Controller
                                  control={form.control}
                                  name={`reward.taskPoints.${i}`}
                                  render={({ field }) => <Input id={fieldId(`reward.taskPoints.${i}`)} inputMode="numeric" className="w-24 shrink-0 font-mono" {...field} />}
                                />
                              </div>
                              {isSelfReportedTask(t.type) && Number(taskPointsWatched?.[i] ?? 0) > 0 && (
                                <p className="flex items-baseline gap-2 text-[0.8125rem] text-ink-2">
                                  <span aria-hidden="true" className="font-mono font-semibold text-signal">
                                    !
                                  </span>
                                  This task is self-reported, so its points can be earned without doing anything.
                                </p>
                              )}
                            </div>
                          ))}
                          {rewardErrors.taskPoints?.message && <InlineError>{rewardErrors.taskPoints.message}</InlineError>}
                        </div>
                      </>
                    )}

                    {rewardType === 'ERC20' && settlementMode !== 'MERKLE' && humanityGatedWatched && (
                      <Notice tone="attention" title="A required verified-human task will be added">
                        Tiered payouts have no reward list to filter, so “Verified humans only” is enforced by a required verified-human task instead. It’s added automatically; you don’t need to add it yourself.
                      </Notice>
                    )}

                    {rewardType === 'ERC721' && !rewardLocked && (
                      <div id={fieldId('reward.tokenIds')} tabIndex={-1} className="grid gap-2 outline-none">
                        <p className="text-[0.9375rem] font-semibold text-ink">Tokens to deposit</p>
                        <p className="-mt-1 text-[0.8125rem] text-ink-2">Each row is one prize for one qualifying wallet. More than 100 are deposited in automatic batches.</p>
                        <NftTokenTable rows={nftRows} onChange={applyNftRows} standard={nftStandard} />
                        {rewardErrors.tokenIds?.message && <InlineError>{rewardErrors.tokenIds.message}</InlineError>}
                      </div>
                    )}

                    {rewardType === 'None' && (
                      <Controller
                        control={form.control}
                        name="reward.name"
                        render={({ field, fieldState }) => (
                          <Field id={fieldId('reward.name')} label="Reward description" error={fieldState.error?.message}>
                            {(p) => <Input {...p} placeholder="e.g. A special role in our Discord" {...field} />}
                          </Field>
                        )}
                      />
                    )}

                    <Controller
                      control={form.control}
                      name="maxParticipants"
                      render={({ field, fieldState }) => (
                        <Field
                          id={fieldId('maxParticipants')}
                          label="Participant cap"
                          optional
                          help="Once this many wallets have qualified, joining closes (up to 100,000). Leave it blank for no cap."
                          error={fieldState.error?.message}
                        >
                          {(p) => <Input {...p} inputMode="numeric" placeholder="No cap" className="font-mono" {...field} />}
                        </Field>
                      )}
                    />
                  </>
                )}

                {step === 4 &&
                  (() => {
                    const v = form.getValues()
                    const coverUrl = v.imageUrl && v.imageUrl !== PLACEHOLDER_IMAGE_URL ? v.imageUrl : null
                    // reward is a union by type; path reads keep each field typed regardless.
                    const amount = form.getValues('reward.amount')
                    const tokenAddress = form.getValues('reward.tokenAddress') || ''
                    const nftStd = form.getValues('reward.nftStandard') ?? 'ERC721'
                    const summary = scheduleSummary(schedule, new Date())
                    // Once the campaign exists on-chain its details and tasks are fixed, so only the
                    // reward (configured in later transactions) can still be edited.
                    const editable = !campaignCreated
                    const payout =
                      rewardType === 'ERC721'
                        ? 'One NFT each'
                        : settlementMode === 'RANK_TIERED'
                          ? `Ranked · ${plural((rankTiersWatched || []).length, 'tier')}`
                          : settlementMode === 'SCORE_TIERED'
                            ? `By points · ${plural((scoreTiersWatched || []).length, 'tier')}`
                            : 'Equal split · reward list'
                    const humanityNote = humanityGatedWatched
                      ? rewardType === 'ERC20' && settlementMode !== 'MERKLE'
                        ? 'A required verified-human task is added'
                        : 'Verified humans only'
                      : null
                    // `done` mirrors the resume flags onSubmit skips on a retry.
                    const txSteps = [
                      { label: 'Create the campaign and add its tasks', done: campaignCreated },
                      {
                        label:
                          rewardType === 'ERC20'
                            ? `Set the reward token, approve ${tokenSymbol} if needed, and fund the pool`
                            : `Deposit ${plural(nftCount, `${nftStd} item`)}, approving the collection first if needed`,
                        done: rewardLocked,
                      },
                      rewardType === 'ERC20' && settlementMode === 'RANK_TIERED' ? { label: 'Set the rank tiers', done: pendingTiersSet } : null,
                      rewardType === 'ERC20' && settlementMode === 'SCORE_TIERED' ? { label: 'Set the score tiers and task points', done: pendingTiersSet } : null,
                      v.maxParticipants ? { label: 'Set the participant cap', done: pendingCapSet } : null,
                      { label: 'Sign a message to save the image and descriptions (no gas)', done: false },
                    ].filter((x): x is { label: string; done: boolean } => !!x)

                    return (
                      <>
                        <Panel>
                          <ReviewSection title="The campaign" onEdit={editable ? () => setStep(1) : undefined} editLabel="Edit the campaign details">
                            {coverUrl && (
                              // eslint-disable-next-line @next/next/no-img-element -- host-supplied cover from any host
                              <img src={coverUrl} alt="" className="mb-2 aspect-[16/7] w-full rounded-md border border-rule bg-sunk object-cover" />
                            )}
                            <p className="dd-display text-[1.625rem] leading-[1.15] text-ink [overflow-wrap:anywhere]">{v.title}</p>
                            <p className="text-[0.9375rem] text-ink-2 [overflow-wrap:anywhere]">{v.shortDescription}</p>
                            <KeyValueList
                              className="mt-2"
                              items={[
                                { label: 'Cover image', value: coverUrl ? 'Added' : 'None' },
                                { label: 'Eligibility', value: humanityNote ?? 'Any wallet' },
                              ]}
                            />
                          </ReviewSection>
                          <ReviewSection title="Schedule" onEdit={editable ? () => setStep(1) : undefined} editLabel="Edit the schedule">
                            <p className="text-[0.9375rem] text-ink">{summary.primary}</p>
                            <p className="font-mono text-[0.8125rem] text-ink-2">{summary.utc}</p>
                            <p className="text-[0.8125rem] text-ink-3">The start and end can’t be changed after the campaign is created.</p>
                          </ReviewSection>
                          <ReviewSection title={`Tasks · ${v.tasks.length}`} onEdit={editable ? () => setStep(2) : undefined} editLabel="Edit the tasks">
                            <ol className="grid">
                              {v.tasks.map((task, i) => (
                                <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-t border-rule py-3 first:border-t-0 first:pt-0">
                                  <span className="font-mono text-[0.8125rem] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                                  <span className="min-w-0 flex-1 text-[0.9375rem] text-ink [overflow-wrap:anywhere]">
                                    {task.description}
                                    {task.isOptional && <span className="ml-1.5 text-[0.8125rem] text-ink-3">(optional)</span>}
                                  </span>
                                  <VerificationChip method={TASK_VERIFICATION_METHOD[task.type as TaskType]} />
                                </li>
                              ))}
                            </ol>
                          </ReviewSection>
                          <ReviewSection title="Reward" onEdit={minStep <= 3 ? () => setStep(3) : undefined} editLabel="Edit the reward">
                            <KeyValueList
                              items={[
                                {
                                  label: rewardType === 'ERC20' ? 'Pool' : 'Items',
                                  value:
                                    rewardType === 'ERC20'
                                      ? `${Number.isFinite(Number(amount)) ? Number(amount).toLocaleString(undefined, { maximumFractionDigits: 18 }) : amount} ${tokenSymbol}`
                                      : `${nftCount} × ${nftStd}`,
                                },
                                { label: rewardType === 'ERC20' ? 'Token' : 'Collection', value: <CopyableAddress address={tokenAddress} /> },
                                { label: 'Payout', value: payout },
                                ...(v.maxParticipants ? [{ label: 'Participant cap', value: plural(Number(v.maxParticipants), 'wallet') }] : []),
                              ]}
                            />
                          </ReviewSection>
                        </Panel>

                        {/* FR-H5: itemise the funding transaction before the host signs it. Shown in
                            the rail on desktop and here below it. */}
                        <div className="grid gap-4 lg:hidden">
                          <RailPanels {...rail} feeCapNote={feeCapNote} />
                        </div>

                        <section aria-labelledby="create-steps-h" className="grid gap-3">
                          <h2 id="create-steps-h" className="text-[1.0625rem] font-semibold text-ink">
                            What happens when you click Create
                          </h2>
                          <ol className="border-y border-rule">
                            {txSteps.map((t, i) => (
                              <li key={i} className="flex items-baseline gap-3 border-t border-rule py-3 first:border-t-0">
                                <span className="w-6 shrink-0 font-mono text-[0.8125rem] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                                <span className={t.done ? 'text-ink-2' : 'text-ink'}>{t.label}</span>
                                {t.done && (
                                  <span className="ml-auto shrink-0 font-mono text-[0.8125rem] text-ink">
                                    <span aria-hidden="true" className="text-signal">
                                      ✓
                                    </span>{' '}
                                    Done
                                  </span>
                                )}
                              </li>
                            ))}
                          </ol>
                          <p className="text-[0.8125rem] leading-relaxed text-ink-2">
                            Your wallet asks you to confirm each step. If one fails, click Create again and the finished steps are skipped. The campaign is created as a draft; you open it to participants in a separate, final step.
                          </p>
                        </section>
                      </>
                    )
                  })()}

                {step < 4 && <WizardRailDisclosure {...rail} feeCapNote={feeCapNote} />}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6">
                  {step > minStep ? (
                    <Button variant="secondary" size="sm" onClick={prevStep}>
                      <span aria-hidden="true">←</span> {STEPS[step - 2].name}
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < 4 ? (
                    <Button onClick={nextStep}>
                      Continue to {STEPS[step].name.toLowerCase()} <span aria-hidden="true">→</span>
                    </Button>
                  ) : (
                    <Button type="submit" loading={isLoading}>
                      {creationProgress || (campaignCreated ? 'Finish setup' : 'Create campaign')}
                    </Button>
                  )}
                </div>
              </form>
              <WizardRail {...rail} feeCapNote={feeCapNote} />
            </div>
          </FormProvider>
        </>
      )}
    </PageContainer>
  )
}
