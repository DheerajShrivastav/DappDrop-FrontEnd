/**
 * Back-compat layer over the ONE status model in ./campaign-status.ts.
 *
 * `getLifecycleState` used to return `open` for any on-chain `Open`, whatever the time, so
 * campaigns that ended weeks ago still read "Open". It now delegates to the time-aware
 * `getCampaignStatus`; existing callers keep their import path. New code should import
 * from './campaign-status' directly.
 */

import type { Campaign, SettlementMode } from './types'
import {
  getCampaignStatus,
  type CampaignDisplayState,
  type CampaignStatusInfo,
  type CampaignStatusInput,
} from './campaign-status'

export {
  ROOT_DISPUTE_WINDOW_MS,
  CLAIM_GRACE_PERIOD_MS,
  SETTLEMENT_FALLBACK_DELAY_MS,
} from './campaign-status'

export type LifecycleState = CampaignDisplayState
export type LifecycleInfo = CampaignStatusInfo

export function getLifecycleState(
  campaign: CampaignStatusInput,
  now: Date = new Date(),
): LifecycleInfo {
  return getCampaignStatus(campaign, now)
}

/**
 * Human-readable settlement-mode label for badges (FR-D1), or null when the mode is unknown
 * (settlement facts not loaded) or not committed yet. Unknown means no chip, never "TBD".
 */
export function settlementModeLabel(mode: SettlementMode | undefined): string | null {
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
      return null
  }
}

/**
 * The reward line for a campaign: the host's reward name when there is one, otherwise the
 * true state. "Reward not set" only when the chain says no reward mode is committed; when we
 * simply couldn't load the details, say that instead of implying anything.
 */
export function rewardDisplayLabel(campaign: Pick<Campaign, 'reward' | 'settlement'>): string {
  const name = campaign.reward?.name?.trim()
  if (name) return name
  const mode = campaign.settlement?.mode
  if (mode === 'UNSET') return 'Reward not set'
  return settlementModeLabel(mode) ?? 'Reward details not available'
}
