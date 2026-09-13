/**
 * Canonical participant-facing lifecycle state ladder (PRD NFR-9). Derives the honest,
 * named state a campaign is in — including the 24h dispute window and 30-day grace period
 * as first-class states — from the indexed on-chain facts on `Campaign.settlement`.
 *
 * Single source of truth for lifecycle copy across discovery cards and the detail page.
 *
 * BR-I4 caveat: this is for DISPLAY. A value-bearing action (actually claiming) must
 * re-verify against a direct RPC read at execution time — that gating lands in P1.
 */

import type { Campaign, CampaignSettlement, SettlementMode } from './types'

// Windows/periods (mirror the contract constants; see docs/REWARD_SYSTEM.md).
export const ROOT_DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1000 // ROOT_DISPUTE_WINDOW
export const CLAIM_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000 // CLAIM_GRACE_PERIOD
export const SETTLEMENT_FALLBACK_DELAY_MS = 14 * 24 * 60 * 60 * 1000 // SETTLEMENT_FALLBACK_DELAY

export type LifecycleState =
  | 'draft'
  | 'open'
  | 'ended_finalizing' // Ended, no root published yet
  | 'overdue_fallback' // Ended 14d+ with no root — publication overdue (NFR-11)
  | 'allocations_published' // root set, within the 24h dispute window
  | 'claims_open' // root set, dispute window elapsed
  | 'closed_claimable' // Closed, within the 30-day grace period
  | 'swept' // unclaimed escrow swept / claiming ended
  | 'cancelled' // terminal, refunded

export type LifecycleInfo = {
  state: LifecycleState
  /** Short label for badges/status chips. */
  label: string
  /** One-line honest explanation of the state (the "why the wait" copy). */
  detail: string
  /** When Merkle claims become actionable (rootPublishedAt + 24h), if known. */
  claimsOpenAt?: Date
  /** When the host may sweep unclaimed funds (closedAt + 30d), if known. */
  sweepEligibleAt?: Date
  /** True while the current-published root is inside its 24h dispute window. */
  inDisputeWindow: boolean
  /** True once claims can actually be submitted (tiered: at Ended; Merkle: window elapsed). */
  claimable: boolean
}

// Tiered campaigns settle purely from on-chain state — no host root, no dispute window.
function isTiered(mode: SettlementMode | undefined): boolean {
  return mode === 'RANK_TIERED' || mode === 'SCORE_TIERED'
}

// The published Merkle root + its publish time for whichever Merkle path this campaign uses.
function merkleRoot(s: CampaignSettlement | undefined): {
  root: string | null | undefined
  publishedAt: Date | undefined
} {
  if (!s) return { root: undefined, publishedAt: undefined }
  if (s.mode === 'NFT') {
    return { root: s.nftMerkleRoot, publishedAt: s.nftRootPublishedAt }
  }
  return { root: s.erc20MerkleRoot, publishedAt: s.erc20RootPublishedAt }
}

/**
 * Compute the lifecycle state for a campaign at time `now` (default: current time).
 * Pure and deterministic given the campaign snapshot.
 */
export function getLifecycleState(
  campaign: Campaign,
  now: Date = new Date(),
): LifecycleInfo {
  const s = campaign.settlement
  const t = now.getTime()

  if (campaign.status === 'Cancelled') {
    return {
      state: 'cancelled',
      label: 'Cancelled',
      detail: 'This campaign was cancelled and any escrow was refunded to the host.',
      inDisputeWindow: false,
      claimable: false,
    }
  }

  if (campaign.status === 'Draft') {
    return {
      state: 'draft',
      label: 'Draft',
      detail: 'This campaign is being configured and is not open yet.',
      inDisputeWindow: false,
      claimable: false,
    }
  }

  if (campaign.status === 'Open') {
    return {
      state: 'open',
      label: 'Open',
      detail: 'Complete tasks before the campaign ends to qualify for rewards.',
      inDisputeWindow: false,
      claimable: false,
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
      state: 'swept',
      label: 'Claiming ended',
      detail: 'Unclaimed rewards have been swept back to the host. Claiming is closed.',
      sweepEligibleAt,
      inDisputeWindow: false,
      claimable: false,
    }
  }

  if (campaign.status === 'Closed') {
    return {
      state: 'closed_claimable',
      label: 'Closed — claim now',
      detail: sweepEligibleAt
        ? `Allocations are frozen. Claim before ${sweepEligibleAt.toLocaleDateString()}, after which unclaimed rewards return to the host.`
        : 'Allocations are frozen. Claim before the grace period ends.',
      claimsOpenAt,
      sweepEligibleAt,
      inDisputeWindow: false,
      claimable: true,
    }
  }

  // status === 'Ended'
  if (tiered) {
    return {
      state: 'claims_open',
      label: 'Claims open',
      detail: 'Rewards are computed on-chain from your rank/score — claim any time.',
      inDisputeWindow: false,
      claimable: true,
    }
  }

  if (!hasRoot) {
    // No root yet. If the host is overdue past the 14-day fallback delay, say so (NFR-11).
    const overdueAt = campaign.endDate.getTime() + SETTLEMENT_FALLBACK_DELAY_MS
    if (t >= overdueAt) {
      return {
        state: 'overdue_fallback',
        label: 'Publication overdue',
        detail:
          'The host has not finalized allocations. The platform can publish them as a fallback so claims can open.',
        inDisputeWindow: false,
        claimable: false,
      }
    }
    return {
      state: 'ended_finalizing',
      label: 'Results being finalized',
      detail: 'The campaign has ended and reward allocations are being prepared.',
      inDisputeWindow: false,
      claimable: false,
    }
  }

  // Root published. Are we still inside the 24h dispute window?
  const windowElapsed = claimsOpenAt !== undefined && t >= claimsOpenAt.getTime()
  if (!windowElapsed) {
    return {
      state: 'allocations_published',
      label: 'Allocations published',
      detail: claimsOpenAt
        ? `Allocations are public for a 24-hour community review window. Claims open at ${claimsOpenAt.toLocaleString()}.`
        : 'Allocations are published; a 24-hour community review window is in progress.',
      claimsOpenAt,
      inDisputeWindow: true,
      claimable: false,
    }
  }

  return {
    state: 'claims_open',
    label: 'Claims open',
    detail: 'Reward allocations are final. You can claim your allocation now.',
    claimsOpenAt,
    inDisputeWindow: false,
    claimable: true,
  }
}

const ZERO_ROOT =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

/** Human-readable settlement-mode label for badges (FR-D1). */
export function settlementModeLabel(mode: SettlementMode | undefined): string {
  switch (mode) {
    case 'MERKLE_ERC20':
      return 'Token · Merkle'
    case 'RANK_TIERED':
      return 'Token · Rank-tiered'
    case 'SCORE_TIERED':
      return 'Token · Score-tiered'
    case 'NFT':
      return 'NFT'
    default:
      return 'Reward TBD'
  }
}
