'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAllCampaigns } from '@/lib/web3-service'
import type { Campaign } from '@/lib/types'
import { useWallet } from '@/context/wallet-provider'
import { partitionHiddenCampaigns } from '@/config/hidden-campaigns'
import { CampaignsView } from './_components/campaigns-view'
import { useWalletRewards } from './_lib/use-wallet-rewards'

/**
 * /campaigns: discovery (app-design §2.1). Filtering and sorting run client-side over the indexer
 * data, so the page never waits on a live RPC call (NFR-4). Internal test runs
 * (src/config/hidden-campaigns.ts) are hidden by default, with a toggle.
 *
 * Load failures render an in-place error with [Try again] (APP-02: it used to be silent, an
 * empty list plus a toast). The view is in ./_components/campaigns-view.tsx.
 */
export default function CampaignsPage() {
  const { address } = useWallet()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    let failed: string | null = null
    try {
      const list = await getAllCampaigns({ onError: (reason) => (failed = reason) })
      setCampaigns(list)
    } catch (e) {
      failed = e instanceof Error && e.message ? `${e.message}.` : 'The request failed.'
      setCampaigns([])
    }
    setError(failed)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { visible, hidden } = useMemo(() => partitionHiddenCampaigns(campaigns), [campaigns])
  const { joined, rewards } = useWalletRewards(campaigns, address)

  return <CampaignsView listed={visible} hidden={hidden} loading={loading} error={error} onRetry={load} joined={joined} rewards={rewards} />
}
