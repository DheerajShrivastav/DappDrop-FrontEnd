'use client'

import { useEffect, useState } from 'react'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import { Loader2, Gavel, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
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
import { submitERC20MerkleRoot, mapContractRevertToMessage } from '@/lib/web3-service'
import { ROOT_DISPUTE_WINDOW_MS } from '@/lib/campaign-lifecycle'

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
        title: 'Allocation proposed',
        description: `${data.allocation.entries.length} qualifying wallet(s). Review the table below before publishing.`,
      })
      await fetchLatest()
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not propose allocation',
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
        title: 'Allocation root published',
        description:
          'Claims open in 24 hours (the community review / dispute window).',
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gavel className="h-5 w-5" /> Review & Publish Allocations
        </CardTitle>
        <CardDescription>
          The proposal below is computed off-chain from on-chain task completions. You
          review it, then sign the publish transaction yourself — the platform never
          publishes a root on your behalf.
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
                    ? new Date(
                        new Date(allocation.publishedAt).getTime() +
                          ROOT_DISPUTE_WINDOW_MS,
                      ).toLocaleString()
                    : 'once the 24h review window elapses'}
                  .
                </span>
              </div>
            )}

            {allocation && allocation.status === 'PROPOSED' && (
              <div className="flex items-start gap-2 rounded-md border border-status-pending-border bg-status-pending-bg text-status-pending-fg p-3 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Version {allocation.version} is proposed but not yet published.
                  Nothing is claimable until you publish it.
                </span>
              </div>
            )}

            {allocation ? (
              <>
                <div className="text-sm text-muted-foreground">
                  Total allocated:{' '}
                  {formatAmount(allocation.totalAmount, allocation.decimals, allocation.symbol)}{' '}
                  · Policy: {allocation.policy} · {allocation.entries.length} wallet(s)
                </div>
                <div className="max-h-80 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Tasks completed</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocation.entries.map((e) => (
                        <TableRow key={e.wallet}>
                          <TableCell className="font-mono text-xs">
                            {e.wallet}
                          </TableCell>
                          <TableCell>{e.tasksCompleted}</TableCell>
                          <TableCell className="text-right">
                            {formatAmount(e.amount, allocation.decimals, allocation.symbol)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {allocation.excludedForHumanity &&
                  allocation.excludedForHumanity.length > 0 && (
                    <div className="space-y-2 rounded-md border border-status-pending-border bg-status-pending-bg p-3">
                      <div className="flex items-start gap-2 text-sm text-status-pending-fg">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                          {allocation.excludedForHumanity.length} wallet(s) excluded — not
                          Humanity-verified. These wallets completed every task but are not
                          Humanity-verified, so they are excluded from this gated campaign&apos;s
                          allocation. Confirm this is intended before publishing.
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded border bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Excluded wallet</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allocation.excludedForHumanity.map((w) => (
                              <TableRow key={w}>
                                <TableCell className="font-mono text-xs">{w}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No allocation has been proposed yet.
              </p>
            )}

            {isClosed ? (
              <p className="text-sm text-muted-foreground">
                This campaign is closed — the allocation is frozen and can no longer be changed.
                Participants can still claim until the grace period ends.
              </p>
            ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handlePropose}
                disabled={isProposing}
              >
                {isProposing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {allocation ? 'Re-propose (recompute)' : 'Propose Allocation'}
              </Button>
              {allocation && allocation.status === 'PROPOSED' && (
                <AlertDialog open={isRepublishConfirmOpen} onOpenChange={setIsRepublishConfirmOpen}>
                  <Button onClick={handlePublish} disabled={isPublishing}>
                    {isPublishing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
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
