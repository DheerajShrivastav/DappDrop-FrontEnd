'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, Gavel, Ban, AlertTriangle, Trophy } from 'lucide-react'
import type { Campaign } from '@/lib/types'
import {
  getLifecycleState,
  type LifecycleState,
} from '@/lib/campaign-lifecycle'
import { cn } from '@/lib/utils'

/**
 * Renders the canonical participant-facing lifecycle state (PRD NFR-9) as an honest,
 * named banner: Open → Ended (finalizing) → Allocations published (claims open at …) →
 * Claims open → Closed (claim by …) → Swept; plus Cancelled and the fallback-overdue state.
 * Recomputed every 30s so the 24h dispute window and 30-day grace tick over live.
 */
export function CampaignLifecycleBanner({ campaign }: { campaign: Campaign }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const lifecycle = getLifecycleState(campaign, now)

  // The Open/Draft states are already conveyed by the hero — banner is for the settlement
  // ladder that users otherwise can't see.
  if (lifecycle.state === 'open' || lifecycle.state === 'draft') return null

  const style = bannerStyle(lifecycle.state)

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4',
        style.container,
      )}
      role="status"
    >
      <div className={cn('mt-0.5 shrink-0', style.icon)}>{style.Icon}</div>
      <div className="min-w-0">
        <p className="font-semibold">{lifecycle.label}</p>
        <p className="text-sm text-muted-foreground">{lifecycle.detail}</p>
        {lifecycle.inDisputeWindow && lifecycle.claimsOpenAt && (
          <p className="mt-1 text-sm font-medium">
            Claims open {lifecycle.claimsOpenAt.toLocaleString()}
          </p>
        )}
        {lifecycle.state === 'closed_claimable' && lifecycle.sweepEligibleAt && (
          <p className="mt-1 text-sm font-medium">
            Unclaimed rewards return to the host after{' '}
            {lifecycle.sweepEligibleAt.toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}

function bannerStyle(state: LifecycleState): {
  container: string
  icon: string
  Icon: React.ReactNode
} {
  switch (state) {
    case 'ended_finalizing':
      return {
        container: 'border-blue-500/30 bg-blue-500/5',
        icon: 'text-blue-500',
        Icon: <Clock className="h-5 w-5" />,
      }
    case 'allocations_published':
      return {
        container: 'border-amber-500/30 bg-amber-500/5',
        icon: 'text-amber-500',
        Icon: <Gavel className="h-5 w-5" />,
      }
    case 'claims_open':
      return {
        container: 'border-emerald-500/30 bg-emerald-500/5',
        icon: 'text-emerald-500',
        Icon: <Trophy className="h-5 w-5" />,
      }
    case 'closed_claimable':
      return {
        container: 'border-emerald-500/30 bg-emerald-500/5',
        icon: 'text-emerald-500',
        Icon: <CheckCircle2 className="h-5 w-5" />,
      }
    case 'overdue_fallback':
      return {
        container: 'border-orange-500/40 bg-orange-500/10',
        icon: 'text-orange-500',
        Icon: <AlertTriangle className="h-5 w-5" />,
      }
    case 'swept':
      return {
        container: 'border-slate-400/30 bg-slate-400/5',
        icon: 'text-slate-500',
        Icon: <CheckCircle2 className="h-5 w-5" />,
      }
    case 'cancelled':
      return {
        container: 'border-slate-400/30 bg-slate-400/5',
        icon: 'text-slate-500',
        Icon: <Ban className="h-5 w-5" />,
      }
    default:
      return {
        container: 'border-border bg-muted/30',
        icon: 'text-muted-foreground',
        Icon: <Clock className="h-5 w-5" />,
      }
  }
}
