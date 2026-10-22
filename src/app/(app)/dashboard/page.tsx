'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useWallet } from '@/context/wallet-provider'
import type { Campaign } from '@/lib/types'
import { getCampaignsByHostAddress } from '@/lib/web3-service'
import { DashboardView, type DashboardGate, type OverviewStats } from './_components/dashboard-view'

/**
 * /dashboard: the host's home (app-design §2.6). The view is ./_components/dashboard-view.tsx.
 *
 * APP-12: a disconnected visitor used to get a destructive "Unauthorized" toast and a redirect to
 * `/`, and a non-host "Access Denied" and the same redirect. Both are now in-place states
 * ("Connect the wallet you host with." / "This wallet doesn't host any campaigns yet.").
 *
 * Data, unchanged: the host's campaigns from getCampaignsByHostAddress (indexer first, RPC
 * fallback), and the DB-native overview (/api/campaigns/analytics-overview, needs the SIWE
 * session): sponsored claims and Humanity-excluded wallets.
 */
export default function DashboardPage() {
  const { address, role, isConnected, connectWallet } = useWallet()
  // wagmi restores a previous session after hydration: until it settles, don't flash "Connect".
  const { status: accountStatus } = useAccount()
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [overview, setOverview] = useState<OverviewStats>({ status: 'loading' })
  // The server and the first client render can't know the wallet: show the skeleton, not "Connect".
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const load = useCallback(async () => {
    if (role !== 'host' || !address) return
    setCampaigns(null)
    setLoadError(null)
    setOverview({ status: 'loading' })
    let failed: string | null = null
    let list: Campaign[] = []
    try {
      list = await getCampaignsByHostAddress(address, { onError: (reason) => (failed = reason) })
    } catch (e) {
      failed = e instanceof Error && e.message ? `${e.message}.` : 'The request failed.'
    }
    setLoadError(failed)
    setCampaigns(list)
    if (failed || list.length === 0) return

    fetch(`/api/campaigns/analytics-overview?campaignIds=${list.map((c) => c.id).join(',')}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((o: { totalSponsoredClaims?: number; totalHumanityExcluded?: number } | null) =>
        setOverview(
          o && typeof o.totalSponsoredClaims === 'number'
            ? { status: 'ok', sponsoredClaims: o.totalSponsoredClaims, humanityExcluded: o.totalHumanityExcluded ?? 0 }
            : { status: 'error' },
        ),
      )
      .catch(() => setOverview({ status: 'error' }))
  }, [role, address])

  useEffect(() => {
    load()
  }, [load])

  const settling = !mounted || accountStatus === 'reconnecting' || accountStatus === 'connecting'
  const gate: DashboardGate = settling
    ? 'checking'
    : !isConnected
      ? 'disconnected'
      : role === null
        ? 'checking'
        : role === 'host'
          ? 'host'
          : 'not-host'

  return (
    <DashboardView
      gate={gate}
      address={isConnected ? address : null}
      onConnect={connectWallet}
      campaigns={campaigns}
      loadError={loadError}
      onRetry={load}
      overview={overview}
    />
  )
}
