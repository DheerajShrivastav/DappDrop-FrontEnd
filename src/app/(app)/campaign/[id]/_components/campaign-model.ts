/**
 * Pure display models for the campaign page (app-design §2.2 / §2.3): the "where this campaign is"
 * ribbon and the host's "Your next steps" checklist. No React, no fetch, no ethers: both read the
 * ONE status model (`getCampaignStatus`, src/lib/campaign-status.ts) and the campaign's own dates,
 * so the ribbon, the chip, the claim panel and the host checklist can never disagree.
 *
 * Unit-tested in campaign-model.test.ts.
 */
import { addMilliseconds, format, isSameDay, isSameMonth, isSameYear } from 'date-fns'
import {
  SETTLEMENT_FALLBACK_DELAY_MS,
  shortDate,
  shortDateTime,
  type CampaignStatusInfo,
  type CampaignStatusInput,
} from '@/lib/campaign-status'
import type { SettlementMode } from '@/lib/types'

export type StopState = 'past' | 'now' | 'later'
export type RibbonStop = { key: string; label: string; state: StopState }

/** Ranked and by-points campaigns pay from on-chain rank or score: no list, no 24-hour review. */
export function isTieredMode(mode: SettlementMode | undefined | null): boolean {
  return mode === 'RANK_TIERED' || mode === 'SCORE_TIERED'
}

/** "7 Aug" (one day), "1–8 Oct", "28 Sep – 8 Oct", "28 Dec 2026 – 3 Jan 2027". */
export function dateRange(start: Date, end: Date): string {
  if (isSameDay(start, end)) return format(end, 'd MMM')
  if (isSameMonth(start, end)) return `${format(start, 'd')}–${format(end, 'd MMM')}`
  if (isSameYear(start, end)) return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`
}

/** When a list campaign's reward list is due (end + 14 days; after that DappDrop may publish it). */
export function listDueBy(campaign: Pick<CampaignStatusInput, 'endDate'>): Date {
  return addMilliseconds(new Date(campaign.endDate), SETTLEMENT_FALLBACK_DELAY_MS)
}

/**
 * The ribbon's stops for a campaign in `status`. List campaigns (Merkle ERC20, NFT, or a mode not
 * committed yet) have six stops; ranked / by-points campaigns skip the list and its 24 hours.
 * Exactly one stop is `now`, except for a cancelled campaign, which gets its own two stops.
 */
export function ribbonStops(campaign: CampaignStatusInput, status: Pick<CampaignStatusInfo, 'state' | 'label' | 'sweepEligibleAt'>): RibbonStop[] {
  const start = new Date(campaign.startDate)
  const end = new Date(campaign.endDate)
  const tiered = isTieredMode(campaign.settlement?.mode)
  const s = status.state

  if (s === 'cancelled') {
    return [
      { key: 'created', label: 'Created', state: 'past' },
      { key: 'cancelled', label: 'Cancelled · refunded', state: 'now' },
    ]
  }

  // Index of the current stop on the list-campaign ladder (tiered skips index 2).
  const NOW: Record<Exclude<CampaignStatusInfo['state'], 'cancelled'>, number> = {
    draft: 0,
    upcoming: 0,
    open: 1,
    ended_unrecorded: 1,
    ended_finalizing: 2,
    overdue_fallback: 2,
    allocations_published: 2,
    claims_open: 3,
    closed_claimable: 4,
    closed_no_claimants: 4,
    swept: 5,
  }
  const current = NOW[s]
  const at = (i: number): StopState => (i < current ? 'past' : i === current ? 'now' : 'later')

  const opened =
    s === 'draft' ? 'Draft · not open yet' : s === 'upcoming' ? `Opens ${shortDate(start)}` : `Opened ${shortDate(start)}`
  const ended =
    s === 'open' ? `Open · ends ${shortDate(end)}` : s === 'ended_unrecorded' ? `Ended ${shortDate(end)} · not recorded yet` : current > 1 ? `Ended ${shortDate(end)}` : `Ends ${shortDate(end)}`
  const list =
    s === 'ended_finalizing' ? 'Reward list next' : s === 'overdue_fallback' ? 'Reward list overdue' : 'List public · 24 h'
  const close =
    s === 'closed_claimable' ? status.label : s === 'closed_no_claimants' ? 'Closed · nobody to pay' : 'Host closes · 30 days to claim'
  const reclaim = s === 'swept' ? 'Host took back what was left' : 'Host takes back what’s left'

  const stops: RibbonStop[] = [
    { key: 'opened', label: opened, state: at(0) },
    { key: 'ended', label: ended, state: at(1) },
    { key: 'list', label: list, state: at(2) },
    { key: 'claims', label: 'Claims open', state: at(3) },
    { key: 'close', label: close, state: at(4) },
    { key: 'reclaim', label: reclaim, state: at(5) },
  ]
  return tiered ? stops.filter((x) => x.key !== 'list') : stops
}

// ---------------------------------------------------------------------------------------------
// The host checklist (§2.3)
// ---------------------------------------------------------------------------------------------

export type HostStepKey = 'created' | 'opened' | 'ended' | 'list' | 'review' | 'close' | 'reclaim'
export type HostStep = { key: HostStepKey; title: string; detail: string; state: StopState; date?: string }

export type HostPlan = {
  steps: HostStep[]
  /** 1-based position of the current step, or null when every step is done (swept). */
  currentIndex: number | null
  /** The host bar's sentence after "You host this campaign." */
  needsYou: string
}

/**
 * The host's next steps. `participants` is the on-chain count. The `close` step is guarded
 * (`closeBlocked`) when a list campaign with participants has no published list: closing then
 * would leave nobody able to claim (OUT-C03; the contract rejects it after the redeploy).
 */
export function hostPlan(
  campaign: CampaignStatusInput,
  status: Pick<CampaignStatusInfo, 'state' | 'claimsOpenAt' | 'sweepEligibleAt'>,
): HostPlan & { closeBlocked: boolean } {
  const s = status.state
  const tiered = isTieredMode(campaign.settlement?.mode)
  const start = new Date(campaign.startDate)
  const end = new Date(campaign.endDate)
  const due = listDueBy(campaign)
  const settlement = campaign.settlement
  const publishedAt = settlement?.mode === 'NFT' ? settlement?.nftRootPublishedAt : settlement?.erc20RootPublishedAt
  const joined = campaign.participants

  const order: HostStepKey[] = tiered
    ? ['created', 'opened', 'ended', 'close', 'reclaim']
    : ['created', 'opened', 'ended', 'list', 'review', 'close', 'reclaim']

  const CURRENT: Record<Exclude<CampaignStatusInfo['state'], 'cancelled'>, HostStepKey | null> = {
    draft: 'opened',
    upcoming: 'ended',
    open: 'ended',
    ended_unrecorded: 'ended',
    ended_finalizing: 'list',
    overdue_fallback: 'list',
    allocations_published: 'review',
    claims_open: 'close',
    closed_claimable: 'reclaim',
    closed_no_claimants: 'reclaim',
    swept: null,
  }
  const currentKey = s === 'cancelled' ? null : CURRENT[s]
  const currentPos = currentKey ? order.indexOf(currentKey) : order.length
  const stateOf = (k: HostStepKey): StopState => {
    const i = order.indexOf(k)
    return i < currentPos ? 'past' : i === currentPos ? 'now' : 'later'
  }

  const people = joined === 1 ? '1 wallet joined.' : `${joined.toLocaleString('en-US')} wallets joined.`
  const detail: Record<HostStepKey, string> = {
    created: s === 'draft' ? 'The campaign and its reward are set up as a draft.' : 'The reward is held in escrow by the contract.',
    opened:
      s === 'draft'
        ? 'Participants can join once you open it. You can’t move the end time later.'
        : s === 'upcoming'
          ? `Opens ${shortDateTime(start)}. Participants can join from then.`
          : people,
    ended:
      s === 'open' || s === 'upcoming'
        ? `Ends on schedule · ${shortDateTime(end)}. There’s nothing to press: it ends by itself.`
        : s === 'ended_unrecorded'
          ? `The end time (${shortDateTime(end)}) has passed, but the end isn’t recorded on-chain yet. Anyone can record it.`
          : tiered
            ? `${shortDateTime(end)}. Tasks are closed. Rewards are worked out on-chain from rank or score, so there’s no list to publish.`
            : `${shortDateTime(end)}. Tasks are closed.`,
    list:
      s === 'overdue_fallback'
        ? `The list was due by ${shortDate(due)}, so DappDrop can publish one for you. You can still publish it yourself; claims open 24 hours after.`
        : `Propose the list, check it, then publish it. Claims open 24 hours after you publish. If there’s no list by ${shortDate(due)}, DappDrop can publish one for you; the 24 hours still apply.`,
    review:
      s === 'allocations_published' && status.claimsOpenAt
        ? `The list is public. Claims open ${shortDateTime(status.claimsOpenAt)}. Your community can report a concern; you can publish a corrected list, and the 24 hours restart.`
        : 'Your community can check the list and report a concern. You can publish a corrected list; the 24 hours restart.',
    close:
      s === 'closed_claimable' || s === 'closed_no_claimants' || s === 'swept'
        ? 'Closed. The list is frozen.'
        : 'Closing freezes the list. Participants then have 30 days to claim.',
    reclaim:
      s === 'swept'
        ? 'The 30 days are over and the unclaimed reward went back to you.'
        : status.sweepEligibleAt
          ? `From ${shortDate(status.sweepEligibleAt)} you can take back what’s unclaimed.`
          : '30 days after you close, take back any unclaimed rewards.',
  }
  const title: Record<HostStepKey, string> = {
    created: s === 'draft' ? 'Created' : 'Created and funded',
    opened: s === 'draft' ? 'Open the campaign' : 'Opened to participants',
    ended: s === 'open' || s === 'upcoming' ? 'Runs until the end time' : s === 'ended_unrecorded' ? 'Record the end' : 'Ended on schedule',
    list: 'Publish the reward list',
    review: '24-hour public review',
    close: 'Close the campaign',
    reclaim: 'Take back what’s left',
  }
  const dates: Partial<Record<HostStepKey, Date | undefined>> = {
    opened: s === 'draft' || s === 'upcoming' ? undefined : start,
    ended: end,
    list: publishedAt,
    review: status.claimsOpenAt,
    close: settlement?.closedAt,
    reclaim: settlement?.erc20SweptAt,
  }

  const steps: HostStep[] = order.map((k) => {
    const state = stateOf(k)
    const d = dates[k]
    return { key: k, title: title[k], detail: detail[k], state, date: state === 'past' && d ? shortDate(d) : undefined }
  })

  const needsYou: Record<CampaignStatusInfo['state'], string> = {
    draft: 'One thing needs you: open the campaign.',
    upcoming: `Nothing needs you until it ends on ${shortDate(end)}.`,
    open: `Nothing needs you until it ends on ${shortDate(end)}.`,
    ended_unrecorded: 'One thing needs you: record the end, so the results can follow.',
    ended_finalizing: `One thing needs you: publish the reward list by ${shortDate(due)}.`,
    overdue_fallback: 'The reward list is overdue. Publish it now, or DappDrop can publish one for you.',
    allocations_published: status.claimsOpenAt
      ? `The list is in its 24-hour review. Claims open ${shortDateTime(status.claimsOpenAt)}.`
      : 'The list is in its 24-hour review.',
    claims_open: 'When you’re ready, close the campaign. Participants then have 30 days to claim.',
    closed_claimable: status.sweepEligibleAt
      ? `Nothing needs you. From ${shortDate(status.sweepEligibleAt)} you can take back what’s unclaimed.`
      : 'Nothing needs you while participants claim.',
    closed_no_claimants: status.sweepEligibleAt
      ? `Nobody can claim. From ${shortDate(status.sweepEligibleAt)} you can take back the reward.`
      : 'Nobody can claim. You can take back the reward once the 30 days are over.',
    swept: 'This campaign is complete.',
    cancelled: 'This campaign was cancelled and the reward went back to you.',
  }

  const listMissing = s === 'ended_finalizing' || s === 'overdue_fallback'
  const closeBlocked = !tiered && listMissing && joined > 0

  return {
    steps,
    currentIndex: currentKey ? currentPos + 1 : null,
    needsYou: needsYou[s],
    closeBlocked,
  }
}
