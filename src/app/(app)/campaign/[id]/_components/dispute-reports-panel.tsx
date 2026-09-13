'use client'

import { formatAllocationAmount, formatNFTAllocation } from '@/lib/allocation-format'
import { useEffect, useState, useCallback } from 'react'
import { Loader2, MessageSquareWarning, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import type { Campaign } from '@/lib/types'
import { closeCampaignOnChain, mapContractRevertToMessage } from '@/lib/web3-service'

type Report = {
  id: string
  reporterWallet: string
  merkleRoot: string
  category: string
  reason: string
  status: string
  hostResponse: string | null
  createdAt: string
  reviewedAt: string | null
  allocation: {
    amount: string
    tasksCompleted: number
    rewardKind: 'ERC20' | 'NFT'
    decimals: number | null
    symbol: string | null
    standard: string | null
    tokenId: string | null
  } | null
}

/**
 * Host resolution flow for reported concerns (P4 Part 4), shared by the ERC20 and NFT
 * settlement panels — same reports data model, same close-guard, regardless of settlement mode.
 * Re-proposing/republishing itself is NOT duplicated here — that flow already lives in each
 * settlement panel; this section is where the host reviews WHY they might want to.
 */
export function DisputeReportsPanel({ campaign }: { campaign: Campaign }) {
  const { toast } = useToast()
  const [reports, setReports] = useState<Report[]>([])
  const [priorRootReports, setPriorRootReports] = useState<Report[]>([])
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [isResolving, setIsResolving] = useState<string | null>(null)
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/reports`, { credentials: 'include' })
      const data = await res.json()
      setReports(res.ok ? data.reports ?? [] : [])
      setPriorRootReports(res.ok ? data.priorRootReports ?? [] : [])
      setMerkleRoot(data.merkleRoot ?? null)
    } catch {
      setReports([])
      setPriorRootReports([])
    } finally {
      setIsLoading(false)
    }
  }, [campaign.id])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleResolve = async (reportId: string) => {
    setIsResolving(reportId)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hostResponse: responses[reportId] || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update report')
      toast({ title: 'Report marked reviewed' })
      await fetchReports()
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not update report', description: e.message })
    } finally {
      setIsResolving(null)
    }
  }

  const handleClose = async () => {
    setIsClosing(true)
    try {
      const txHash = await closeCampaignOnChain(campaign.id)
      toast({ title: 'Campaign closed', description: `Tx: ${txHash}` })
      setIsCloseConfirmOpen(false)
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to close campaign', description: mapContractRevertToMessage(e) })
    } finally {
      setIsClosing(false)
    }
  }

  if (campaign.status !== 'Ended') return null // closeCampaign only makes sense from Ended
  if (isLoading) return null

  // Closing freezes the allocation permanently, so the guard counts EVERY unresolved report —
  // including ones against an earlier root, which a republish may never have addressed.
  const openReports = [...reports, ...priorRootReports].filter((r) => r.status === 'OPEN')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5" /> Reported Concerns
        </CardTitle>
        <CardDescription>
          {merkleRoot
            ? `Reports against the currently published root. No SLA, no automated action — you decide whether to respond or re-propose a corrected allocation above.`
            : 'No published allocation yet, so nothing to report against.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports for the current published allocation.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs">{r.reporterWallet}</span>
                  <Badge variant={r.status === 'OPEN' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                  <Badge variant="outline">{r.category}</Badge>
                  <span className="text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm">{r.reason}</p>
                <p className="text-xs text-muted-foreground">
                  Their allocation:{' '}
                  {r.allocation
                    ? `${
                        r.allocation.rewardKind === 'NFT'
                          ? formatNFTAllocation(r.allocation.standard, r.allocation.tokenId, r.allocation.amount)
                          : formatAllocationAmount(r.allocation.amount, r.allocation.decimals, r.allocation.symbol)
                      } · ${r.allocation.tasksCompleted} task(s) completed`
                    : 'none found in the current allocation'}
                </p>
                {r.status === 'OPEN' ? (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Optional response to the reporter"
                      value={responses[r.id] ?? ''}
                      onChange={(e) => setResponses((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      rows={2}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolve(r.id)}
                      disabled={isResolving === r.id}
                    >
                      {isResolving === r.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Mark reviewed
                    </Button>
                  </div>
                ) : (
                  r.hostResponse && <p className="text-xs italic text-muted-foreground">Response: {r.hostResponse}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reports pinned to a root you've since replaced. Kept reachable deliberately: a
            republish restarts the window but does NOT necessarily address what these reporters
            raised, and root-scoped views alone would bury them permanently. */}
        {priorRootReports.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">
              Reports against earlier allocations ({priorRootReports.length})
            </p>
            {priorRootReports.map((r) => (
              <div key={r.id} className="rounded-md border border-dashed p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs">{r.reporterWallet}</span>
                  <Badge variant={r.status === 'OPEN' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                  <Badge variant="outline">{r.category}</Badge>
                  <span className="text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm">{r.reason}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">root {r.merkleRoot}</p>
                {r.status === 'OPEN' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolve(r.id)}
                    disabled={isResolving === r.id}
                  >
                    {isResolving === r.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Mark reviewed
                  </Button>
                )}
                {r.status !== 'OPEN' && r.hostResponse && (
                  <p className="text-xs italic text-muted-foreground">Response: {r.hostResponse}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-4">
          <AlertDialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
            <Button variant="destructive" onClick={() => setIsCloseConfirmOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" /> Close Campaign
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close this campaign?</AlertDialogTitle>
                <AlertDialogDescription>
                  Closing freezes the allocation permanently — corrections become impossible.
                  {openReports.length > 0
                    ? ` ${openReports.length} unresolved report(s) exist for the current allocation.`
                    : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isClosing}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={isClosing} onClick={handleClose}>
                  {isClosing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Close Campaign'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
