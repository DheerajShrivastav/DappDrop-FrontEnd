'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { Campaign } from '@/lib/types'
import { submitNFTMerkleRoot, mapContractRevertToMessage } from '@/lib/web3-service'
import { plural } from '@/components/app/format'
import { ListReview } from './list-review'

type NFTAllocationEntry = { wallet: string; standard: string | null; tokenId: string | null; amount: string; tasksCompleted: number }
type NFTAllocationSummary = {
  version: number
  root: string
  tokenAddress: string
  totalItems: number
  policy: string
  status: 'PROPOSED' | 'PUBLISHED' | 'SUPERSEDED'
  createdAt: string
  publishedAt: string | null
  excludedForHumanity: string[]
  entries: NFTAllocationEntry[]
}

/**
 * Host-only NFT allocation review & publish (P3 CP2, NFT counterpart of MerkleSettlementPanel).
 * Same host-review → host-publishes flow, same 24h dispute window, same
 * excludedForHumanity surfacing as the ERC20 path — just against setNFTMerkleRoot on the
 * campaign's PINNED NFTSettlementModule instead of the entrypoint.
 */
export function NFTSettlementPanel({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast()
  const [allocation, setAllocation] = useState<NFTAllocationSummary | null>(null)
  const [livePublishedVersion, setLivePublishedVersion] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProposing, setIsProposing] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isRepublishConfirmOpen, setIsRepublishConfirmOpen] = useState(false)

  const fetchLatest = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/nft-allocations/latest`, { credentials: 'include' })
      const data = await res.json()
      setAllocation(res.ok ? data.allocation : null)
      setLivePublishedVersion(res.ok ? data.livePublishedVersion ?? null : null)
    } catch {
      setAllocation(null)
      setLivePublishedVersion(null)
    } finally {
      setIsLoading(false)
    }
  }

  const isRepublish = livePublishedVersion !== null && allocation !== null && livePublishedVersion !== allocation.version

  useEffect(() => {
    fetchLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id])

  const handlePropose = async () => {
    setIsProposing(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/nft-allocations/propose`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to propose NFT allocation')
      toast({
        title: 'List proposed',
        description: `${plural(data.allocation.entries.length, 'wallet')}, one NFT each. Check it below, then publish.`,
      })
      await fetchLatest()
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'The list wasn’t proposed',
        description: e.message || 'Please try again.',
      })
    } finally {
      setIsProposing(false)
    }
  }

  const handlePublish = () => {
    if (!allocation) return
    if (isRepublish) {
      setIsRepublishConfirmOpen(true)
      return
    }
    doPublish()
  }

  const doPublish = async () => {
    if (!allocation) return
    setIsRepublishConfirmOpen(false)
    setIsPublishing(true)
    try {
      await submitNFTMerkleRoot(campaign.id, allocation.root)
      toast({
        title: 'List published',
        description: 'Claims open in 24 hours, after the public review.',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'The list wasn’t published',
        description: mapContractRevertToMessage(e),
      })
      setIsPublishing(false)
      return
    }

    try {
      await fetch(`/api/campaigns/${campaign.id}/nft-allocations/mark-published`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ version: allocation.version }),
      })
    } catch (e) {
      console.warn('nft mark-published bookkeeping failed (non-fatal):', e)
    }

    await fetchLatest()
    setIsPublishing(false)
  }

  if (campaign.status !== 'Ended' && campaign.status !== 'Closed') return null
  // Closing freezes the allocation: setERC20MerkleRoot/the NFT equivalent revert on a Closed
  // campaign (Web3Campaigns__CampaignNotYetEnded), so propose/publish can never succeed here.
  // The panel still renders — the host should keep seeing WHAT was allocated — but offering
  // actions the chain will reject is worse than offering none.
  const isClosed = campaign.status === 'Closed'
  const mode = campaign.settlement?.mode
  if (mode && mode !== 'UNSET' && mode !== 'NFT') return null

  return (
    <ListReview
      isLoading={isLoading}
      allocation={allocation}
      summary={allocation ? `${plural(allocation.totalItems, 'NFT')} for ${plural(allocation.entries.length, 'wallet')} · ${allocation.policy}` : undefined}
      columns={['Wallet', 'Item', 'Qty']}
      rows={(allocation?.entries ?? []).map((e) => ({ key: e.wallet, wallet: e.wallet, cells: [`${e.standard ?? ''} #${e.tokenId ?? ''}`, e.amount] }))}
      excluded={allocation?.excludedForHumanity}
      isClosed={isClosed}
      isProposing={isProposing}
      isPublishing={isPublishing}
      onPropose={handlePropose}
      onPublish={handlePublish}
      republishOpen={isRepublishConfirmOpen}
      onRepublishOpenChange={setIsRepublishConfirmOpen}
      onConfirmRepublish={doPublish}
    />
  )
}
