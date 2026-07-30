'use client'

import { useEffect, useState } from 'react'
import { formatUnits } from 'ethers'
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
}

// Display-only formatting — every on-chain call and reconciliation stays in base units
// (allocation.amount/totalAmount are never parsed back out of this). Falls back to the raw
// base-unit string (labeled) if the token's decimals couldn't be resolved, rather than
// silently guessing a value that could misrepresent the actual allocation.
function formatAmount(raw: string, decimals: number | null, symbol: string | null): string {
  if (decimals == null) return `${raw} (raw units — token decimals unavailable)`
  try {
    const formatted = formatUnits(raw, decimals)
    return symbol ? `${formatted} ${symbol}` : formatted
  } catch {
    return `${raw} (raw units)`
  }
}

/**
 * Host-only allocation review & publish (PRD FR-M3, BR-M1..M3). The pipeline PROPOSES; the
 * host reviews the table and signs `setERC20MerkleRoot` themselves — the backend never
 * publishes on its own. Shown once the campaign has Ended for its ERC20-Merkle host.
 */
export function MerkleSettlementPanel({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast()
  const [allocation, setAllocation] = useState<AllocationSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProposing, setIsProposing] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const fetchLatest = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/allocations/latest`, {
        credentials: 'include',
      })
      const data = await res.json()
      setAllocation(res.ok ? data.allocation : null)
    } catch {
      setAllocation(null)
    } finally {
      setIsLoading(false)
    }
  }

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

  const handlePublish = async () => {
    if (!allocation) return
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No allocation has been proposed yet.
              </p>
            )}

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
                <Button onClick={handlePublish} disabled={isPublishing}>
                  {isPublishing && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Publish Root
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
