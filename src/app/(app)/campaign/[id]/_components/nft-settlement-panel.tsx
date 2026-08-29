'use client'

import { useEffect, useState } from 'react'
import { Loader2, Gavel, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import type { Campaign } from '@/lib/types'
import { submitNFTMerkleRoot, mapContractRevertToMessage } from '@/lib/web3-service'
import { ROOT_DISPUTE_WINDOW_MS } from '@/lib/campaign-lifecycle'

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
        title: 'NFT allocation proposed',
        description: `${data.allocation.entries.length} wallet(s) assigned an item. Review before publishing.`,
      })
      await fetchLatest()
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not propose NFT allocation',
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
        title: 'NFT allocation root published',
        description: 'Claims open in 24 hours (the community review / dispute window).',
      })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to publish root',
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gavel className="h-5 w-5" /> Review & Publish NFT Allocations
        </CardTitle>
        <CardDescription>
          One item per qualifying wallet, assigned from your deposited NFTs. You review it, then
          sign the publish transaction yourself — the platform never publishes a root on your
          behalf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-40 w-full rounded-md" />
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
        ) : (
          <>
            {allocation && allocation.status === 'PUBLISHED' && (
              <div className="flex items-start gap-2 rounded-md border border-status-claimable-border bg-status-claimable-bg text-status-claimable-fg p-3 text-sm">
                <Gavel className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Version {allocation.version} is published. Claims open{' '}
                  {allocation.publishedAt
                    ? new Date(new Date(allocation.publishedAt).getTime() + ROOT_DISPUTE_WINDOW_MS).toLocaleString()
                    : 'once the 24h review window elapses'}
                  .
                </span>
              </div>
            )}
            {allocation && allocation.status === 'PROPOSED' && (
              <div className="flex items-start gap-2 rounded-md border border-status-pending-border bg-status-pending-bg text-status-pending-fg p-3 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Version {allocation.version} is proposed but not yet published. Nothing is
                  claimable until you publish it.
                </span>
              </div>
            )}

            {allocation ? (
              <>
                <div className="text-sm text-muted-foreground">
                  {allocation.totalItems} item(s) allocated · Policy: {allocation.policy}
                </div>
                <div className="max-h-80 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Standard</TableHead>
                        <TableHead>Token ID</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocation.entries.map((e) => (
                        <TableRow key={e.wallet}>
                          <TableCell className="font-mono text-xs">{e.wallet}</TableCell>
                          <TableCell>{e.standard}</TableCell>
                          <TableCell>{e.tokenId}</TableCell>
                          <TableCell className="text-right">{e.amount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {allocation.excludedForHumanity && allocation.excludedForHumanity.length > 0 && (
                  <div className="space-y-2 rounded-md border border-status-pending-border bg-status-pending-bg p-3">
                    <div className="flex items-start gap-2 text-sm text-status-pending-fg">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        {allocation.excludedForHumanity.length} wallet(s) excluded — not
                        Humanity-verified. Confirm this is intended before publishing.
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No NFT allocation has been proposed yet.</p>
            )}

            {isClosed ? (
              <p className="text-sm text-muted-foreground">
                This campaign is closed — the allocation is frozen and can no longer be changed.
                Participants can still claim until the grace period ends.
              </p>
            ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={handlePropose} disabled={isProposing}>
                {isProposing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {allocation ? 'Re-propose (recompute)' : 'Propose NFT Allocation'}
              </Button>
              {allocation && allocation.status === 'PROPOSED' && (
                <AlertDialog open={isRepublishConfirmOpen} onOpenChange={setIsRepublishConfirmOpen}>
                  <Button onClick={handlePublish} disabled={isPublishing}>
                    {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Publish Root
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Publish a corrected allocation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Publishing a different root restarts the 24-hour review window for
                        everyone — all claims are delayed by another 24 hours, including wallets
                        whose allocation is unchanged.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isPublishing}>Cancel</AlertDialogCancel>
                      <AlertDialogAction disabled={isPublishing} onClick={doPublish}>
                        {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish anyway'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
