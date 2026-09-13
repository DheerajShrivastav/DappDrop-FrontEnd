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
  open: 'open',
  ended_finalizing: 'pending',
  allocations_published: 'pending',
  overdue_fallback: 'pending',
  claims_open: 'claimable',
  closed_claimable: 'claimable',
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

const STATUS_STYLES: Record<StatusBucket, StatusStyle> = {
  open: {
    badge: 'bg-status-open-solid text-white border-transparent',
    banner: 'bg-status-open-bg border-status-open-border text-status-open-fg',
    icon: 'text-status-open-fg',
    Icon: CircleDot,
  },
  claimable: {
    badge: 'bg-status-claimable-solid text-white border-transparent',
    banner: 'bg-status-claimable-bg border-status-claimable-border text-status-claimable-fg',
    icon: 'text-status-claimable-fg',
    Icon: Trophy,
  },
  pending: {
    badge: 'bg-status-pending-solid text-white border-transparent',
    banner: 'bg-status-pending-bg border-status-pending-border text-status-pending-fg',
    icon: 'text-status-pending-fg',
    Icon: Clock,
  },
  closed: {
    badge: 'bg-status-closed-solid text-white border-transparent',
    banner: 'bg-status-closed-bg border-status-closed-border text-status-closed-fg',
    icon: 'text-status-closed-fg',
    Icon: CheckCircle2,
  },
  cancelled: {
    badge: 'bg-status-cancelled-solid text-white border-transparent',
    banner: 'bg-status-cancelled-bg border-status-cancelled-border text-status-cancelled-fg',
    icon: 'text-status-cancelled-fg',
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
