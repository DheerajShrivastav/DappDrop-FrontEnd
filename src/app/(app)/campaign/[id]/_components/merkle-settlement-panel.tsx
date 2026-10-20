'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { Campaign } from '@/lib/types'
import { submitERC20MerkleRoot, mapContractRevertToMessage } from '@/lib/web3-service'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import { plural } from '@/components/app'
import { ListReview } from './list-review'
import { amountText, splitAmount } from './reward-panel'

type AllocationEntry = { wallet: string; amount: string; tasksCompleted: number }
type AllocationSummary = {
  version: number
  root: string
  token: string
  decimals: number | null
  symbol: string | null
  totalAmount: string
  policy: string
  status: 'PROPOSED' | 'PUBLISHED' | 'SUPERSEDED'
  createdAt: string
  publishedAt: string | null
  entries: AllocationEntry[]
  // Wallets that completed every task but were excluded from the allocation because they are
  // not Humanity-verified (humanity-gated campaigns only; empty otherwise).
  excludedForHumanity?: string[]
}

/**
 * Host-only allocation review & publish (PRD FR-M3, BR-M1..M3). The pipeline PROPOSES; the
 * host reviews the table and signs `setERC20MerkleRoot` themselves — the backend never
 * publishes on its own. Shown once the campaign has Ended for its ERC20-Merkle host.
 */
export function MerkleSettlementPanel({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast()
  const [allocation, setAllocation] = useState<AllocationSummary | null>(null)
  const [livePublishedVersion, setLivePublishedVersion] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProposing, setIsProposing] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isRepublishConfirmOpen, setIsRepublishConfirmOpen] = useState(false)

  const fetchLatest = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/allocations/latest`, {
        credentials: 'include',
      })
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

  // P4 Part 4: publishing a DIFFERENT root than whatever is currently live restarts the 24h
  // dispute window for EVERYONE, including wallets whose allocation didn't change — a real cost
  // hosts must see before signing, not bury as a toast after the fact.
  const isRepublish = livePublishedVersion !== null && allocation !== null && livePublishedVersion !== allocation.version

  useEffect(() => {
    fetchLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id])

  const handlePropose = async () => {
    setIsProposing(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/allocations/propose`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to propose allocation')
      toast({
        title: 'List proposed',
        description: `${plural(data.allocation.entries.length, 'wallet')} on it. Check it below, then publish.`,
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

    // The on-chain publish is the actual, value-bearing action — its success/failure is
    // what the host needs an accurate toast for. Kept in its own try/catch so a failure
    // here (and only here) is ever reported as "failed to publish".
    try {
      await submitERC20MerkleRoot(campaign.id, allocation.root)
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

    // Best-effort DB bookkeeping (host-review display only) — the on-chain publish above
    // already succeeded, so this is never allowed to surface as a "publish failed" error.
    // The proof API cross-checks the LIVE on-chain root before ever serving a proof (BR-I4),
    // so a lagging/failed status update here can never cause a bad claim — worst case the
    // review table briefly shows "proposed" for a root that's actually already live.
    try {
      await fetch(`/api/campaigns/${campaign.id}/allocations/mark-published`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ version: allocation.version }),
      })
    } catch (e) {
      console.warn('mark-published bookkeeping failed (non-fatal):', e)
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
  // Tiered campaigns commit their mode in Draft (setRankTiers/setScoreTiers) — by the time a
  // campaign reaches Ended, a tiered campaign's mode is already RANK_TIERED/SCORE_TIERED, never
  // UNSET. A Merkle campaign's mode stays UNSET right up until its first setERC20MerkleRoot
  // (which is what this panel exists to do), so UNSET must still render here — only an
  // already-committed NON-Merkle mode (tiered/NFT) must hide this panel (CP1: this Merkle/
  // dispute-window UI must never appear on the tiered path, which has no root to publish).
  const mode = campaign.settlement?.mode
  if (mode && mode !== 'UNSET' && mode !== 'MERKLE_ERC20') return null

  return (
    <ListReview
      isLoading={isLoading}
      allocation={allocation}
      summary={
        allocation
          ? `${plural(allocation.entries.length, 'wallet')} · ${amountText(splitAmount(formatAmount(allocation.totalAmount, allocation.decimals, allocation.symbol)))} in total · ${allocation.policy}`
          : undefined
      }
      columns={['Wallet', 'Tasks done', 'Amount']}
      rows={(allocation?.entries ?? []).map((e) => ({
        key: e.wallet,
        wallet: e.wallet,
        cells: [e.tasksCompleted, amountText(splitAmount(formatAmount(e.amount, allocation!.decimals, allocation!.symbol)))],
      }))}
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
