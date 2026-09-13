'use client'

import { useEffect, useState } from 'react'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import { Download, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import type { Campaign } from '@/lib/types'

type ERC20Entry = { wallet: string; amount: string; tasksCompleted: number }
type NFTEntry = { wallet: string; standard: string | null; tokenId: string | null; amount: string; tasksCompleted: number }

type AllocationSummary = {
  version: number
  root: string
  totalAmount?: string
  totalItems?: number
  decimals?: number | null
  symbol?: string | null
  policy: string
  status: string
  createdAt: string
  publishedAt: string | null
  entries: (ERC20Entry | NFTEntry)[]
}

/**
 * Public, unauthenticated full allocation table (P4 Part 1 — BR-M4). The dispute window's
 * entire purpose is community review, so once a root is PUBLISHED it is shown here to anyone —
 * no wallet connection required. Resolves against whichever of the two allocation routes has a
 * currently-published root (both already do the resolve-against-live-root check server-side —
 * this component never trusts DB status, it just renders what the API decided is public).
 */
export function PublicAllocationView({ campaign }: { campaign: Campaign }) {
  const [allocation, setAllocation] = useState<AllocationSummary | null>(null)
  const [isNFT, setIsNFT] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    Promise.all([
      fetch(`/api/campaigns/${campaign.id}/allocations/latest`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/campaigns/${campaign.id}/nft-allocations/latest`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([erc20, nft]) => {
        if (cancelled) return
        if (erc20?.allocation) {
          setAllocation(erc20.allocation)
          setIsNFT(false)
        } else if (nft?.allocation) {
          setAllocation(nft.allocation)
          setIsNFT(true)
        } else {
          setAllocation(null)
        }
      })
      .catch(() => {
        if (!cancelled) setAllocation(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [campaign.id])

  if (isLoading) {
    return (
      <Card id="allocation-table">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full rounded-md" />
        </CardContent>
      </Card>
    )
  }

  if (!allocation) return null

  return (
    <Card id="allocation-table">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" /> Published Allocation
        </CardTitle>
        <CardDescription>
          Public for the 24-hour community review window — anyone can verify any wallet&apos;s
          allocation against the root actually published on-chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div>
            Root: <span className="font-mono text-xs break-all">{allocation.root}</span>
          </div>
          <div>
            Published: {allocation.publishedAt ? new Date(allocation.publishedAt).toLocaleString() : '—'}
          </div>
          <div>
            {isNFT ? `Total items: ${allocation.totalItems}` : `Total allocated: ${formatAmount(allocation.totalAmount ?? '0', allocation.decimals, allocation.symbol)}`}
          </div>
          <div>Policy: {allocation.policy}</div>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wallet</TableHead>
                {isNFT && <TableHead>Item</TableHead>}
                <TableHead className="text-right">{isNFT ? 'Qty' : 'Amount'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocation.entries.map((e) => (
                <TableRow key={e.wallet}>
                  <TableCell className="font-mono text-xs">{e.wallet}</TableCell>
                  {isNFT && (
                    <TableCell className="text-xs">
                      {(e as NFTEntry).standard} #{(e as NFTEntry).tokenId}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {isNFT ? e.amount : formatAmount(e.amount, allocation.decimals, allocation.symbol)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button variant="outline" size="sm" asChild>
          <a href={`/api/campaigns/${campaign.id}/analytics/export/allocation`} download>
            <Download className="mr-2 h-4 w-4" /> Download CSV
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
