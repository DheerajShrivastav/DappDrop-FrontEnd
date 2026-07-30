'use client'

import { useEffect, useState } from 'react'
import type { Campaign } from '@/lib/types'
import { getLifecycleState } from '@/lib/campaign-lifecycle'
import { getStatusStyle } from '@/lib/status-styles'
import { cn } from '@/lib/utils'

/**
 * Renders the canonical participant-facing lifecycle state (PRD NFR-9) as an honest,
 * named banner: Open → Ended (finalizing) → Allocations published (claims open at …) →
 * Claims open → Closed (claim by …) → Swept; plus Cancelled and the fallback-overdue state.
 * Recomputed every 30s so the 24h dispute window and 30-day grace tick over live. Shares
 * the same muted status palette (src/lib/status-styles.ts) as the discovery card badge.
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

  const style = getStatusStyle(lifecycle.state)
  const Icon = style.Icon

  return (
    <div
      className={cn('flex items-start gap-3 rounded-lg border p-4', style.banner)}
      role="status"
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.icon)} />
      <div className="min-w-0">
        <p className="font-semibold">{lifecycle.label}</p>
        <p className="text-sm opacity-80">{lifecycle.detail}</p>
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
