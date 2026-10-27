/**
 * The ONE campaign status model (app-design.md §1.6). On-chain status + timestamps +
 * indexed settlement facts go in; an honest, time-aware display state comes out. Every
 * status label or chip in the app (cards, the campaign page, the dashboard, the /campaigns
 * filter) reads from here, so two labels on one page can never disagree.
 *
 * Why time-aware: the contract only moves Open → Ended when someone sends `endCampaign`.
 * Until then the on-chain status still says Open after the end time, so a label that just
 * echoed `status` told people a campaign that ended weeks ago was "Open".
 *
 * Pure: no React, no ethers, no fetch. Display only (BR-I4): value-bearing actions re-check
 * the chain at execution time.
 */

import { format } from 'date-fns'
import type { Campaign, CampaignSettlement, SettlementMode } from './types'

// Windows/periods (mirror the contract constants; see docs/REWARD_SYSTEM.md).
export const ROOT_DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1000 // ROOT_DISPUTE_WINDOW
export const CLAIM_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000 // CLAIM_GRACE_PERIOD
export const SETTLEMENT_FALLBACK_DELAY_MS = 14 * 24 * 60 * 60 * 1000 // SETTLEMENT_FALLBACK_DELAY

export type CampaignDisplayState =
  | 'draft'
  | 'upcoming' // Open on-chain, start time not reached
  | 'open' // Open on-chain, inside [start, end]
  | 'ended_unrecorded' // Open on-chain, end time passed: anyone can send endCampaign
  | 'ended_finalizing' // Ended, no list (root) published yet
  | 'overdue_fallback' // Ended 14d+ with no list: the platform may publish it (NFR-11)
  | 'allocations_published' // list (root) public, inside the 24h review window
  | 'claims_open' // list final (Merkle) or tiered at Ended
  | 'closed_claimable' // Closed, inside the 30-day grace period
  | 'closed_no_claimants' // Closed, nobody can claim
  | 'swept' // unclaimed escrow swept: claiming ended
  | 'cancelled' // terminal, refunded

export type CampaignStatusInfo = {
  state: CampaignDisplayState
  /** Short label for chips. */
  label: string
  /** One honest line explaining the state. */
  detail: string
  /** When Merkle claims become actionable (rootPublishedAt + 24h), if known. */
  claimsOpenAt?: Date
  /** When the host may sweep unclaimed funds (closedAt + 30d), if known. */
  sweepEligibleAt?: Date
  /** True while the current published list is inside its 24h review window. */
  inDisputeWindow: boolean
  /** True once claims can actually be submitted. */
  claimable: boolean
  /** True only while participants can still complete tasks. */
  acceptingTasks: boolean
}

/** What the status model needs. A full `Campaign` satisfies it. */
export type CampaignStatusInput = Pick<
  Campaign,
  'status' | 'startDate' | 'endDate' | 'participants'
> & { settlement?: CampaignSettlement }

const ZERO_ROOT =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

/** Short, locale-independent date for chips and detail lines ("20 Sep"). */
export function shortDate(d: Date): string {
  return format(d, 'd MMM')
}

/** Date with time for "claims open at" lines ("17 Oct, 14:00"). */
export function shortDateTime(d: Date): string {
  return format(d, 'd MMM, HH:mm')
}

// Tiered campaigns settle purely from on-chain state: no host list, no review window.
function isTiered(mode: SettlementMode | undefined): boolean {
  return mode === 'RANK_TIERED' || mode === 'SCORE_TIERED'
}

function merkleRoot(s: CampaignSettlement | undefined): {
  root: string | null | undefined
  publishedAt: Date | undefined
} {
  if (!s) return { root: undefined, publishedAt: undefined }
  if (s.mode === 'NFT') return { root: s.nftMerkleRoot, publishedAt: s.nftRootPublishedAt }
  return { root: s.erc20MerkleRoot, publishedAt: s.erc20RootPublishedAt }
}

// The close guard lives in ./close-guard (no date-fns), re-exported for the status model's callers.
export { settlementOwedOnClose } from './close-guard'

const base = { inDisputeWindow: false, claimable: false, acceptingTasks: false }

/**
 * Compute the display state of a campaign at `now` (default: the current time).
 * Deterministic given the input.
 */
export function getCampaignStatus(
  campaign: CampaignStatusInput,
  now: Date = new Date(),
): CampaignStatusInfo {
  const s = campaign.settlement
  const t = now.getTime()
  const start = new Date(campaign.startDate)
  const end = new Date(campaign.endDate)

  if (campaign.status === 'Cancelled') {
    return {
      ...base,
      state: 'cancelled',
      label: 'Cancelled',
      detail: 'This campaign was cancelled and its escrowed reward went back to the host.',
    }
  }

  if (campaign.status === 'Draft') {
    return {
      ...base,
      state: 'draft',
      label: 'Draft',
      detail: 'This campaign is being set up and is not open yet.',
    }
  }

  if (campaign.status === 'Open') {
    if (t < start.getTime()) {
      return {
        ...base,
        state: 'upcoming',
        label: 'Upcoming',
        detail: `Opens ${shortDateTime(start)}. Tasks can be completed from then until ${shortDateTime(end)}.`,
      }
    }
    if (t >= end.getTime()) {
      return {
        ...base,
        state: 'ended_unrecorded',
        label: 'Ended',
        detail: `Ended ${shortDate(end)}. The end isn't recorded on-chain yet; anyone can record it, and results follow.`,
      }
    }
    return {
      ...base,
      state: 'open',
      label: 'Open',
      detail: `Ends ${shortDateTime(end)}. Complete the tasks before then to qualify.`,
      acceptingTasks: true,
    }
  }

  // Ended or Closed below.
  const tiered = isTiered(s?.mode)
  const { root, publishedAt } = merkleRoot(s)
  const hasRoot = tiered ? true : Boolean(root && root !== ZERO_ROOT)
  const claimsOpenAt =
    publishedAt !== undefined
      ? new Date(publishedAt.getTime() + ROOT_DISPUTE_WINDOW_MS)
      : undefined
  const sweepEligibleAt =
    s?.closedAt !== undefined
      ? new Date(s.closedAt.getTime() + CLAIM_GRACE_PERIOD_MS)
      : undefined

  // Swept is terminal for claiming (ERC20 sweep ends all claims; FR-C6/NFR-15).
  if (s?.erc20Swept) {
    return {
      ...base,
      state: 'swept',
      label: 'Claiming ended',
      detail: 'The 30-day claim period is over and the host took back what was left.',
      sweepEligibleAt,
    }
  }

  if (campaign.status === 'Closed') {
    // Nobody can claim from a Closed campaign with zero participants, or from a Merkle/NFT
    // campaign closed without a published list. The list rule only applies when settlement
    // facts actually loaded: a missing snapshot must not be read as "no list".
    const noClaimants =
      campaign.participants === 0 || (s !== undefined && !tiered && !hasRoot)
    if (noClaimants) {
      return {
        ...base,
        state: 'closed_no_claimants',
        label: 'Closed',
        detail: sweepEligibleAt
          ? `Nobody qualified. The host can withdraw the reward from ${shortDate(sweepEligibleAt)}.`
          : 'Nobody qualified. The host can withdraw the reward once the 30-day period ends.',
        sweepEligibleAt,
      }
    }
    return {
      ...base,
      state: 'closed_claimable',
      label: sweepEligibleAt ? `Claim by ${shortDate(sweepEligibleAt)}` : 'Closed · claims open',
      detail: sweepEligibleAt
        ? `Closed. The list is final. Claim before ${shortDate(sweepEligibleAt)}; after that the host can withdraw what's unclaimed.`
        : 'Closed. The list is final. Claim before the 30-day period ends.',
      claimsOpenAt,
      sweepEligibleAt,
      claimable: true,
    }
  }

  // status === 'Ended'
  if (tiered) {
    return {
      ...base,
      state: 'claims_open',
      label: 'Claims open',
      detail: 'Rewards are worked out on-chain from rank or score. There is no list and no 24-hour wait: claim any time.',
      claimable: true,
    }
  }

  if (!hasRoot) {
    const overdueAt = end.getTime() + SETTLEMENT_FALLBACK_DELAY_MS
    if (t >= overdueAt) {
      return {
        ...base,
        state: 'overdue_fallback',
        label: 'Ended · list overdue',
        detail:
          "The host hasn't published the reward list within 14 days, so DappDrop can publish it. Claims still open 24 hours after that.",
      }
    }
    return {
      ...base,
      state: 'ended_finalizing',
      label: 'Ended · results next',
      detail: 'The host publishes the reward list next. Claims open 24 hours after that.',
    }
  }

  const windowElapsed = claimsOpenAt !== undefined && t >= claimsOpenAt.getTime()
  if (!windowElapsed) {
    return {
      ...base,
      state: 'allocations_published',
      label: 'List public · 24 h',
      detail: claimsOpenAt
        ? `Claims open ${shortDateTime(claimsOpenAt)}. Until then, anyone can check the list and report a concern.`
        : 'The reward list is public for a 24-hour review. Anyone can check it and report a concern.',
      claimsOpenAt,
      inDisputeWindow: true,
    }
  }

  return {
    ...base,
    state: 'claims_open',
    label: 'Claims open',
    detail: 'The reward list is final. Claim any time; once the host closes the campaign, there are 30 days left.',
    claimsOpenAt,
    claimable: true,
  }
}

/** /campaigns filter buckets, derived from the display state (never from raw status). */
export type CampaignStatusFilter = 'all' | 'open' | 'claimable' | 'closed'

export function matchesStatusFilter(
  state: CampaignDisplayState,
  filter: CampaignStatusFilter,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'open':
      return state === 'open'
    case 'claimable':
      // Includes the 24h review window: the list is public and claims are about to open.
      return (
        state === 'claims_open' || state === 'allocations_published' || state === 'closed_claimable'
      )
    case 'closed':
      return state === 'swept' || state === 'cancelled' || state === 'closed_no_claimants'
  }
}
