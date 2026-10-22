/**
 * /campaigns discovery (app-design §2.1): the status buckets for the filter, the client-side
 * filter + sort, and the card's fact rows. Pure (no React, no fetch) so it's unit-tested, and the
 * words come from the ONE status model (src/lib/campaign-status.ts): nothing here invents a state.
 */
import { format, formatDistanceStrict } from 'date-fns'
import type { Campaign, SettlementMode } from '@/lib/types'
import { getCampaignStatus, shortDate, shortDateTime, type CampaignDisplayState, type CampaignStatusInfo } from '@/lib/campaign-status'
import { TASK_VERIFICATION_METHOD } from '@/lib/task-types'

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

/** The status segmented control: All · Open · Claims open · Ended · Closed. */
export type StatusBucket = 'all' | 'open' | 'claims' | 'ended' | 'closed'

export const STATUS_BUCKETS: { value: StatusBucket; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'claims', label: 'Claims open' },
  { value: 'ended', label: 'Ended' },
  { value: 'closed', label: 'Closed' },
]

/**
 * Which bucket a display state falls in (null = only under "All": drafts, upcoming).
 * "Claims open" includes the 24-hour review (the list is public; claims are about to open) and a
 * closed campaign still inside its 30-day claim window, as the old "Claimable" filter did.
 */
export function bucketOf(state: CampaignDisplayState): Exclude<StatusBucket, 'all'> | null {
  switch (state) {
    case 'open':
      return 'open'
    case 'allocations_published':
    case 'claims_open':
    case 'closed_claimable':
      return 'claims'
    case 'ended_unrecorded':
    case 'ended_finalizing':
    case 'overdue_fallback':
      return 'ended'
    case 'closed_no_claimants':
    case 'swept':
    case 'cancelled':
      return 'closed'
    default:
      return null
  }
}

export type RewardFilter = 'all' | 'tokens' | 'nfts'
export const REWARD_FILTERS: { value: RewardFilter; label: string }[] = [
  { value: 'all', label: 'Reward: any' },
  { value: 'tokens', label: 'Reward: tokens' },
  { value: 'nfts', label: 'Reward: NFTs' },
]

export type PayoutFilter = 'all' | Exclude<SettlementMode, 'UNSET'>
export const PAYOUT_FILTERS: { value: PayoutFilter; label: string }[] = [
  { value: 'all', label: 'Payout: any' },
  { value: 'MERKLE_ERC20', label: 'Payout: equal split' },
  { value: 'RANK_TIERED', label: 'Payout: ranked' },
  { value: 'SCORE_TIERED', label: 'Payout: by points' },
  { value: 'NFT', label: 'Payout: one NFT each' },
]

export type SortKey = 'newest' | 'ending_soon' | 'most_participants'
export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Sort: newest' },
  { value: 'ending_soon', label: 'Sort: ending soon' },
  { value: 'most_participants', label: 'Sort: most participants' },
]

export type DiscoveryFilters = {
  search: string
  status: StatusBucket
  reward: RewardFilter
  payout: PayoutFilter
  sort: SortKey
}

export const DEFAULT_FILTERS: DiscoveryFilters = { search: '', status: 'all', reward: 'all', payout: 'all', sort: 'newest' }

export function filtersActive(f: DiscoveryFilters): boolean {
  return f.search.trim() !== '' || f.status !== 'all' || f.reward !== 'all' || f.payout !== 'all'
}

/** Search, reward and payout (everything except the status bucket). */
function matchesOther(c: Campaign, f: DiscoveryFilters): boolean {
  const q = f.search.trim().toLowerCase()
  if (q && !`${c.title} ${c.description}`.toLowerCase().includes(q)) return false
  if (f.reward === 'tokens' && c.reward.type !== 'ERC20') return false
  if (f.reward === 'nfts' && c.reward.type !== 'ERC721') return false
  if (f.payout !== 'all' && (c.settlement?.mode ?? 'UNSET') !== f.payout) return false
  return true
}

/**
 * Filter + sort, and the per-bucket counts for the segmented control ("Open · 2"). Counts follow
 * the other filters (search, reward, payout), so a number always matches what clicking shows.
 */
export function applyDiscoveryFilters(
  campaigns: readonly Campaign[],
  f: DiscoveryFilters,
  now: Date = new Date(),
): { results: Campaign[]; counts: Record<StatusBucket, number> } {
  const counts: Record<StatusBucket, number> = { all: 0, open: 0, claims: 0, ended: 0, closed: 0 }
  const results: Campaign[] = []
  for (const c of campaigns) {
    if (!matchesOther(c, f)) continue
    const bucket = bucketOf(getCampaignStatus(c, now).state)
    counts.all++
    if (bucket) counts[bucket]++
    if (f.status === 'all' || f.status === bucket) results.push(c)
  }
  results.sort((a, b) => {
    if (f.sort === 'ending_soon') return a.endDate.getTime() - b.endDate.getTime()
    if (f.sort === 'most_participants') return b.participants - a.participants
    // newest: createdAt isn't on the client type; end date (latest first) is the available proxy.
    return b.endDate.getTime() - a.endDate.getTime()
  })
  return { results, counts }
}

// ---------------------------------------------------------------------------------------------
// Card facts (§1.7)
// ---------------------------------------------------------------------------------------------

/** "in 3 days" (future) / "3 days ago" (past). */
export function relativeWords(d: Date, now: Date): string {
  const words = formatDistanceStrict(d, now, { roundingMethod: 'floor' })
  return d.getTime() >= now.getTime() ? `in ${words}` : `${words} ago`
}

/** The time row follows the state: Opens / Ends / Ended / Claims open / Claim by / Claiming ended. */
export function timeFact(c: Campaign, s: CampaignStatusInfo, now: Date): { label: string; value: string; title?: string } {
  const exact = (d: Date) => format(d, 'd MMM yyyy, HH:mm')
  const st = c.settlement
  switch (s.state) {
    case 'upcoming':
      return { label: 'Opens', value: `${relativeWords(c.startDate, now)} · ${shortDate(c.startDate)}`, title: exact(c.startDate) }
    case 'draft':
    case 'open':
      return { label: 'Ends', value: `${relativeWords(c.endDate, now)} · ${shortDate(c.endDate)}`, title: exact(c.endDate) }
    case 'ended_unrecorded':
    case 'ended_finalizing':
    case 'overdue_fallback':
      return { label: 'Ended', value: shortDate(c.endDate), title: exact(c.endDate) }
    case 'allocations_published':
      return s.claimsOpenAt
        ? { label: 'Claims open', value: shortDateTime(s.claimsOpenAt), title: exact(s.claimsOpenAt) }
        : { label: 'Ended', value: shortDate(c.endDate), title: exact(c.endDate) }
    case 'claims_open':
      return { label: 'Claims', value: 'Open now' }
    case 'closed_claimable':
      return s.sweepEligibleAt
        ? { label: 'Claim by', value: shortDate(s.sweepEligibleAt), title: exact(s.sweepEligibleAt) }
        : { label: 'Closed', value: st?.closedAt ? shortDate(st.closedAt) : 'Yes' }
    case 'closed_no_claimants':
      return st?.closedAt ? { label: 'Closed', value: shortDate(st.closedAt), title: exact(st.closedAt) } : { label: 'Ended', value: shortDate(c.endDate) }
    case 'swept': {
      const d = st?.erc20SweptAt ?? s.sweepEligibleAt
      return d ? { label: 'Claiming ended', value: shortDate(d), title: exact(d) } : { label: 'Ended', value: shortDate(c.endDate) }
    }
    case 'cancelled': {
      const d = st?.cancelledAt
      return d ? { label: 'Cancelled', value: shortDate(d), title: exact(d) } : { label: 'Cancelled', value: 'Refunded' }
    }
  }
}

/**
 * The reward row: the host's reward name, or the truth when there isn't one. Never "TBD", never
 * an invented "Reward for <title>".
 */
export function rewardFact(c: Campaign): { label: string; value: string } {
  const label = c.settlement?.mode === 'NFT' || c.reward.type === 'ERC721' ? 'Reward' : 'Reward pool'
  const name = c.reward.name?.trim()
  if (name) return { label, value: name }
  if (c.settlement?.mode === 'UNSET') return { label, value: 'Not set yet' }
  return { label, value: 'Not available' }
}

/** "38 of 500" with a cap, otherwise the count. */
export function participantsFact(c: Campaign): string {
  const n = c.participants.toLocaleString('en-US')
  const cap = c.settlement?.maxParticipants ?? 0
  return cap > 0 ? `${n} of ${cap.toLocaleString('en-US')}` : n
}

/** "2 checked · 1 self-reported" (how the tasks are verified), or "" when there are none. */
export function taskCheckSummary(c: Pick<Campaign, 'tasks'>): string {
  let checked = 0
  let self = 0
  for (const t of c.tasks) {
    const method = TASK_VERIFICATION_METHOD[t.type]
    if (method === 'self-reported') self++
    else if (method) checked++
  }
  const parts: string[] = []
  if (checked) parts.push(`${checked} checked`)
  if (self) parts.push(`${self} self-reported`)
  return parts.join(' · ')
}
