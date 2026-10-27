/**
 * The label / chip map for the ONE campaign status model (src/lib/campaign-status.ts) and the
 * other chip families (app-design §1.6). Pure data, server-safe: chips, cards, the campaign page
 * ribbon and the dashboard read their chip style from here, and their words from the status
 * model, so two chips on one page can never disagree.
 *
 * The state is always in words; the mark (●, ◷, !) and the style only repeat it (WCAG 1.4.1).
 */
import type { CampaignDisplayState, CampaignStatusInfo } from '@/lib/campaign-status'
import type { SettlementMode } from '@/lib/types'
import type { TaskVerificationMethod } from '@/lib/task-types'
import { claims } from '@/config/claims'

/** Chip styles. `claim` is the only gold fill; `error` the only red (failed transactions). */
export type ChipVariant =
  | 'neutral'
  | 'open'
  | 'ended'
  | 'review'
  | 'claim'
  | 'closed'
  | 'draft'
  | 'cancelled'
  | 'check'
  | 'self'
  | 'example'
  | 'attention'
  | 'error'

export type ChipSpec = {
  variant: ChipVariant
  /** Decorative mark before the words (aria-hidden). */
  mark?: '●' | '◷' | '!' | '✓'
  /** Overrides the status model's label where the design's chip says more. */
  label?: string
}

/** Every display state → its chip (the design table in app-design §1.6). */
export const STATUS_CHIP: Record<CampaignDisplayState, ChipSpec> = {
  draft: { variant: 'draft' },
  upcoming: { variant: 'neutral', mark: '◷' },
  open: { variant: 'open', mark: '●' },
  ended_unrecorded: { variant: 'ended', mark: '◷' },
  ended_finalizing: { variant: 'ended', mark: '◷' },
  overdue_fallback: { variant: 'attention', mark: '!' },
  allocations_published: { variant: 'review' },
  claims_open: { variant: 'claim' },
  closed_claimable: { variant: 'claim' },
  closed_no_claimants: { variant: 'closed' },
  swept: { variant: 'closed' },
  cancelled: { variant: 'cancelled', label: 'Cancelled · refunded' },
}

/** The chip for a computed status: style from the map, words from the model. */
export function statusChip(info: Pick<CampaignStatusInfo, 'state' | 'label'>, opts: { hostFundedDraft?: boolean } = {}): Required<Pick<ChipSpec, 'variant'>> & { mark?: ChipSpec['mark']; label: string } {
  const spec = STATUS_CHIP[info.state]
  let label = spec.label ?? info.label
  if (info.state === 'draft' && opts.hostFundedDraft) label = 'Draft · funded'
  return { variant: spec.variant, mark: spec.mark, label }
}

/**
 * Payout labels without the jargon (§1.6). `null` when the mode is unknown: unknown → no chip,
 * never "TBD".
 */
export function payoutLabel(mode: SettlementMode | undefined | null, opts: { rankedCount?: number } = {}): string | null {
  switch (mode) {
    case 'MERKLE_ERC20':
      return 'Equal split · reward list'
    case 'RANK_TIERED':
      return opts.rankedCount ? `Ranked · first ${opts.rankedCount.toLocaleString('en-US')}` : 'Ranked'
    case 'SCORE_TIERED':
      return 'By points'
    case 'NFT':
      return 'One NFT each'
    default:
      return null
  }
}

/** Short payout names for option cards, filters and the rail ("Payout: Equal split"). */
export function payoutShortLabel(mode: SettlementMode | undefined | null): string | null {
  switch (mode) {
    case 'MERKLE_ERC20':
      return 'Equal split'
    case 'RANK_TIERED':
      return 'Ranked'
    case 'SCORE_TIERED':
      return 'By points'
    case 'NFT':
      return 'One NFT each'
    default:
      return null
  }
}

/** How a task is checked → its verification chip (§1.6), from TASK_VERIFICATION_METHOD. */
export const VERIFICATION_CHIP: Record<TaskVerificationMethod, ChipSpec & { label: string; note?: string }> = {
  'bot-membership': { variant: 'check', mark: '✓', label: 'Checked by our bot' },
  'siwe-session': { variant: 'check', mark: '✓', label: 'Signed by your wallet' },
  payment: { variant: 'check', mark: '✓', label: 'Checked on-chain' },
  contract: { variant: 'check', mark: '✓', label: 'Checked on-chain' },
  // claims.humanityNaming (founder decision D18): name Humanity Protocol only once approved.
  humanity: { variant: 'check', mark: '✓', label: claims.humanityNaming ? 'Humanity check' : 'Verified-human check' },
  'self-reported': { variant: 'self', label: 'Self-reported', note: 'Not checked automatically yet' },
}
