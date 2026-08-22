'use client'

import { useEffect, useState } from 'react'
import type { Campaign } from '@/lib/types'
import { getLifecycleState } from '@/lib/campaign-lifecycle'
import { getStatusStyle } from '@/lib/status-styles'
import { cn } from '@/lib/utils'
import { formatAllocationAmount, formatNFTAllocation } from '@/lib/allocation-format'
import { useWallet } from '@/context/wallet-provider'
import { ReportConcernDialog } from './report-concern-dialog'

type WalletAllocation = {
  status: string
  amount?: string
  // ERC20 only
  decimals?: number | null
  symbol?: string | null
  // NFT only
  standard?: string | null
  tokenId?: string | null
}

/**
 * Renders the canonical participant-facing lifecycle state (PRD NFR-9) as an honest,
 * named banner: Open → Ended (finalizing) → Allocations published (claims open at …) →
 * Claims open → Closed (claim by …) → Swept; plus Cancelled and the fallback-overdue state.
 * Recomputed every 30s so the 24h dispute window and 30-day grace tick over live. Shares
 * the same muted status palette (src/lib/status-styles.ts) as the discovery card badge.
 *
 * P4: during the dispute window, this is where people actually land — so it also surfaces the
 * connected wallet's own allocation (or the plain fact that it has none), a link to the full
 * public allocation table, and the "report a concern" entry point.
 */
export function CampaignLifecycleBanner({ campaign }: { campaign: Campaign }) {
  const { address, isConnected } = useWallet()
  const [now, setNow] = useState(() => new Date())
  const [walletAllocation, setWalletAllocation] = useState<WalletAllocation | null>(null)
  const [isLoadingAllocation, setIsLoadingAllocation] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const lifecycle = getLifecycleState(campaign, now)

  // NFT-settled campaigns have their own proof endpoint with a different response shape —
  // querying the ERC20 one for an NFT campaign 404s and would tell a wallet that genuinely has
  // an allocation that it has none, which is exactly the wrong thing to say during a review
  // window. Same mode branch the settlement/claim panels use.
  const isNFT = campaign.settlement?.mode === 'NFT'

  useEffect(() => {
    if (lifecycle.state !== 'allocations_published' || !isConnected || !address) {
      setWalletAllocation(null)
      return
    }
    // Guard against out-of-order responses: switching wallets mid-flight could otherwise let a
    // stale response for the previous wallet overwrite the current one's allocation.
    let cancelled = false
    setIsLoadingAllocation(true)
    const path = isNFT ? 'nft-allocation' : 'allocation'
    fetch(`/api/campaigns/${campaign.id}/${path}/${address}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setWalletAllocation(data)
      })
      .catch(() => {
        if (!cancelled) setWalletAllocation(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAllocation(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycle.state, isConnected, address, campaign.id, isNFT])

  // The Open/Draft states are already conveyed by the hero — banner is for the settlement
  // ladder that users otherwise can't see.
  if (lifecycle.state === 'open' || lifecycle.state === 'draft') return null

  const style = getStatusStyle(lifecycle.state)
  const Icon = style.Icon
  const inDisputeWindow = lifecycle.state === 'allocations_published'

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-4', style.banner)} role="status">
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.icon)} />
      <div className="min-w-0 flex-1">
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

        {inDisputeWindow && (
          <>
            <div className="mt-3 rounded-md border bg-background/50 p-3 text-sm">
              {!isConnected ? (
                <span className="text-muted-foreground">Connect your wallet to see your allocation.</span>
              ) : isLoadingAllocation ? (
                <span className="text-muted-foreground">Checking your allocation…</span>
              ) : walletAllocation && walletAllocation.status !== 'not_allocated' ? (
                <span className="font-medium">
                  Your allocation:{' '}
                  {isNFT
                    ? formatNFTAllocation(
                        walletAllocation.standard,
                        walletAllocation.tokenId,
                        walletAllocation.amount,
                      )
                    : formatAllocationAmount(
                        walletAllocation.amount ?? '0',
                        walletAllocation.decimals,
                        walletAllocation.symbol,
                      )}
                </span>
              ) : (
                <span className="text-muted-foreground">This wallet has no allocation in this campaign.</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a href="#allocation-table" className="text-sm font-medium underline underline-offset-4">
                View all allocations
              </a>
              <ReportConcernDialog campaignId={campaign.id} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
