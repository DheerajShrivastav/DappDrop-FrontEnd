import type { LucideIcon } from 'lucide-react'
import {
  CircleDot,
  Trophy,
  Clock,
  Gavel,
  AlertTriangle,
  CheckCircle2,
  Ban,
} from 'lucide-react'
import type { LifecycleState } from './campaign-lifecycle'

/**
 * Single source of truth mapping every campaign lifecycle state to ONE of five muted,
 * desaturated status buckets (design direction: strictly monochrome app, status color is
 * the one functional exception — never decorative). Both the discovery card badge and the
 * campaign-detail lifecycle banner consume this so they never drift from each other.
 */
export type StatusBucket = 'open' | 'claimable' | 'pending' | 'closed' | 'cancelled'

export const STATUS_BUCKET_BY_LIFECYCLE: Record<LifecycleState, StatusBucket> = {
  draft: 'closed',
  upcoming: 'pending',
  open: 'open',
  ended_unrecorded: 'pending',
  ended_finalizing: 'pending',
  allocations_published: 'pending',
  overdue_fallback: 'pending',
  claims_open: 'claimable',
  closed_claimable: 'claimable',
  closed_no_claimants: 'closed',
  swept: 'closed',
  cancelled: 'cancelled',
}

export type StatusStyle = {
  /** Filled badge/pill: solid-ish background, readable foreground. */
  badge: string
  /** Soft banner/callout: pale background, colored border, matching text. */
  banner: string
  /** Icon-only color class. */
  icon: string
  Icon: LucideIcon
}

// 08-site phase 1: the old --status-* palette is retired in the app (app-design §1.1); these
// buckets now use the Monolith tokens, so the existing chips and banners read in both themes
// until phase 2 moves them to <CampaignStatusChip/> (src/components/app). Gold fill = claimable
// only; no red here (the red is for errors and failed transactions).
const STATUS_STYLES: Record<StatusBucket, StatusStyle> = {
  open: {
    badge: 'bg-transparent border-ink-2 text-ink',
    banner: 'bg-surface border-rule-strong text-ink',
    icon: 'text-ink',
    Icon: CircleDot,
  },
  claimable: {
    badge: 'bg-signal text-on-signal border-transparent',
    banner: 'bg-surface border-signal text-ink',
    icon: 'text-signal',
    Icon: Trophy,
  },
  pending: {
    badge: 'bg-transparent border-ink-3 text-ink-2',
    banner: 'bg-surface border-rule-strong text-ink',
    icon: 'text-ink-2',
    Icon: Clock,
  },
  closed: {
    badge: 'bg-transparent border-rule-strong text-ink-2',
    banner: 'bg-surface border-rule text-ink-2',
    icon: 'text-ink-2',
    Icon: CheckCircle2,
  },
  cancelled: {
    badge: 'bg-transparent border-dashed border-rule-strong text-ink-2',
    banner: 'bg-surface border-dashed border-rule-strong text-ink-2',
    icon: 'text-ink-2',
    Icon: Ban,
  },
}

// A couple of states read better with a more specific icon than their bucket's default
// (e.g. "finalizing" vs "overdue" are both `pending` but shouldn't share an icon).
const ICON_OVERRIDES: Partial<Record<LifecycleState, LucideIcon>> = {
  allocations_published: Gavel,
  overdue_fallback: AlertTriangle,
  cancelled: Ban,
}

export function getStatusStyle(state: LifecycleState): StatusStyle {
  const bucket = STATUS_BUCKET_BY_LIFECYCLE[state]
  const base = STATUS_STYLES[bucket]
  const Icon = ICON_OVERRIDES[state] ?? base.Icon
  return { ...base, Icon }
}
