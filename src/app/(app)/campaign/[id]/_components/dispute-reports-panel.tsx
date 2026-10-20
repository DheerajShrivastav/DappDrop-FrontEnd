'use client'

import { formatAllocationAmount, formatNFTAllocation } from '@/lib/allocation-format'
import { useEffect, useState, useCallback } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import type { Campaign } from '@/lib/types'
import { cancelCampaignOnChain, closeCampaignOnChain, getCloseOptions, mapContractRevertToMessage } from '@/lib/web3-service'
import { Button, Chip, Spinner, Textarea, buttonClass, plural, shortAddress } from '@/components/app'

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

const CATEGORY_LABEL: Record<string, string> = {
  missing_allocation: 'Missing from the list',
  wrong_amount: 'Amount looks wrong',
  sybil_suspected: 'Fake or farmed wallets',
  other: 'Other',
}

/**
 * The host's reports against the published list (P4 Part 4), shared by the ERC20 and NFT
 * campaigns. One fetch feeds both the reports list (step 05) and the close dialog's warning
 * (step 06): closing freezes the list permanently, so the dialog counts EVERY unresolved report,
 * including ones against an earlier list that a republish may never have addressed.
 */
export function useHostReports(campaignId: string, enabled: boolean) {
  const [reports, setReports] = useState<Report[]>([])
  const [priorRootReports, setPriorRootReports] = useState<Report[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/reports`, { credentials: 'include' })
      const data = await res.json()
      setReports(res.ok ? (data.reports ?? []) : [])
      setPriorRootReports(res.ok ? (data.priorRootReports ?? []) : [])
    } catch {
      setReports([])
      setPriorRootReports([])
    } finally {
      setIsLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    if (enabled) fetchReports()
  }, [enabled, fetchReports])

  const openCount = [...reports, ...priorRootReports].filter((r) => r.status === 'OPEN').length
  return { reports, priorRootReports, isLoading, refetch: fetchReports, openCount }
}

export type HostReports = ReturnType<typeof useHostReports>

function ReportItem({
  r,
  earlier,
  response,
  onResponse,
  onResolve,
  resolving,
}: {
  r: Report
  earlier?: boolean
  response: string
  onResponse: (v: string) => void
  onResolve: () => void
  resolving: boolean
}) {
  const yours = r.allocation
    ? `${r.allocation.rewardKind === 'NFT' ? formatNFTAllocation(r.allocation.standard, r.allocation.tokenId, r.allocation.amount) : formatAllocationAmount(r.allocation.amount, r.allocation.decimals, r.allocation.symbol)} · ${plural(r.allocation.tasksCompleted, 'task')} done`
    : 'not on the current list'
  return (
    <li className="grid gap-2 border-b border-rule py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2 text-small">
        <span className="font-mono text-ink" title={r.reporterWallet}>
          {shortAddress(r.reporterWallet)}
        </span>
        <Chip variant={r.status === 'OPEN' ? 'attention' : 'closed'} mark={r.status === 'OPEN' ? '!' : '✓'}>
          {r.status === 'OPEN' ? 'Open' : 'Reviewed'}
        </Chip>
        <Chip variant="neutral">{CATEGORY_LABEL[r.category] ?? r.category}</Chip>
        <span className="font-mono text-[0.8125rem] text-ink-2">{new Date(r.createdAt).toLocaleString()}</span>
      </div>
      <p className="text-small text-ink [overflow-wrap:anywhere]">{r.reason}</p>
      <p className="text-[0.8125rem] text-ink-2">On the list: {yours}</p>
      {earlier && <p className="font-mono text-[0.75rem] text-ink-2 [overflow-wrap:anywhere]">Earlier list {r.merkleRoot}</p>}
      {r.status === 'OPEN' ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
          {!earlier && (
            <Textarea
              aria-label={`Your reply to ${shortAddress(r.reporterWallet)} (optional)`}
              placeholder="A reply to the reporter (optional)"
              value={response}
              onChange={(e) => onResponse(e.target.value)}
              rows={2}
            />
          )}
          <Button size="sm" variant="secondary" onClick={onResolve} loading={resolving}>
            Mark reviewed
          </Button>
        </div>
      ) : (
        r.hostResponse && <p className="text-[0.8125rem] italic text-ink-2">Your reply: {r.hostResponse}</p>
      )}
    </li>
  )
}

/** The reports against the published list (step 05). No SLA and no automatic action: the host decides. */
export function ReportsList({ campaignId, data }: { campaignId: string; data: HostReports }) {
  const { toast } = useToast()
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [isResolving, setIsResolving] = useState<string | null>(null)

  const handleResolve = async (reportId: string) => {
    setIsResolving(reportId)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hostResponse: responses[reportId] || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update report')
      toast({ title: 'Report marked reviewed' })
      await data.refetch()
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'The report wasn’t updated', description: e.message })
    } finally {
      setIsResolving(null)
    }
  }

  if (data.isLoading) return null
  return (
    <div className="grid gap-3" data-reports>
      <p className="text-small font-semibold text-ink">
        Reports on this list <span className="font-mono font-normal text-ink-2">· {data.reports.length}</span>
      </p>
      {data.reports.length === 0 ? (
        <p className="text-small text-ink-2">No reports on this list.</p>
      ) : (
        <ul className="border-t border-rule">
          {data.reports.map((r) => (
            <ReportItem
              key={r.id}
              r={r}
              response={responses[r.id] ?? ''}
              onResponse={(v) => setResponses((p) => ({ ...p, [r.id]: v }))}
              onResolve={() => handleResolve(r.id)}
              resolving={isResolving === r.id}
            />
          ))}
        </ul>
      )}
      {/* Reports on a list you've since replaced stay reachable: a republish restarts the window
          but doesn't necessarily address what these reporters raised. */}
      {data.priorRootReports.length > 0 && (
        <>
          <p className="mt-2 text-small font-semibold text-ink">
            Reports on earlier lists <span className="font-mono font-normal text-ink-2">· {data.priorRootReports.length}</span>
          </p>
          <ul className="border-t border-rule">
            {data.priorRootReports.map((r) => (
              <ReportItem key={r.id} r={r} earlier response="" onResponse={() => {}} onResolve={() => handleResolve(r.id)} resolving={isResolving === r.id} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/**
 * [Close campaign] and its dialog (step 06). The dialog reads the chain fresh each time it opens
 * (getCloseOptions): with nobody joined it offers "Cancel campaign instead" (an immediate refund).
 *
 * `blockedReason`: the host-close guard (OUT-C03) for a list campaign with participants and no
 * published list. TODO(redeploy): the redeployed contract reverts `SettlementNotPublished` here;
 * map it in mapContractRevertToMessage to "Can't close yet. Publish the reward list first." (the
 * revert mapping is frozen until then, so this button guard is the only UI hook today).
 */
export function CloseCampaignAction({
  campaign,
  openReports,
  primary,
  blockedReason,
  onStatusChange,
}: {
  campaign: Campaign
  openReports: number
  primary: boolean
  blockedReason?: string
  onStatusChange?: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [closeOptions, setCloseOptions] = useState<{ totalParticipants: number; canCancel: boolean } | null>(null)
  const [isLoadingCloseOptions, setIsLoadingCloseOptions] = useState(false)
  const isNFT = campaign.settlement?.mode === 'NFT' || campaign.reward.type === 'ERC721'

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCloseOptions(null)
    setIsLoadingCloseOptions(true)
    getCloseOptions(campaign.id)
      .then((o) => !cancelled && setCloseOptions(o))
      // A failed read just means no zero-participant warning/cancel offer; closing still works.
      .catch(() => !cancelled && setCloseOptions(null))
      .finally(() => !cancelled && setIsLoadingCloseOptions(false))
    return () => {
      cancelled = true
    }
  }, [open, campaign.id])

  const handleCancelInstead = async () => {
    setIsCancelling(true)
    try {
      const txHash = await cancelCampaignOnChain(campaign.id)
      toast({
        title: 'Campaign cancelled',
        description: isNFT ? `Your NFTs can be withdrawn now. Tx: ${txHash}` : `The escrowed tokens went back to your wallet. Tx: ${txHash}`,
      })
      setOpen(false)
      onStatusChange?.()
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'The campaign wasn’t cancelled', description: mapContractRevertToMessage(e) })
    } finally {
      setIsCancelling(false)
    }
  }

  const handleClose = async () => {
    setIsClosing(true)
    try {
      const txHash = await closeCampaignOnChain(campaign.id)
      toast({ title: 'Campaign closed', description: `Participants have 30 days to claim. Tx: ${txHash}` })
      setOpen(false)
      onStatusChange?.()
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'The campaign wasn’t closed', description: mapContractRevertToMessage(e) })
    } finally {
      setIsClosing(false)
    }
  }

  if (blockedReason) {
    return (
      <Button size="sm" variant="secondary" disabled disabledReason={blockedReason}>
        Close campaign
      </Button>
    )
  }

  const busy = isClosing || isCancelling
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <Button size="sm" variant={primary ? 'primary' : 'secondary'} onClick={() => setOpen(true)}>
        Close campaign
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close this campaign?</AlertDialogTitle>
          <AlertDialogDescription>
            The list is frozen, and participants then have 30 days to claim. You can’t undo this or correct the list afterwards.
            {openReports > 0 ? ` ${plural(openReports, 'report')} on the list ${openReports === 1 ? 'is' : 'are'} still open.` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isLoadingCloseOptions && (
          <p className="flex items-center gap-2 text-small text-ink-2" role="status">
            <Spinner /> Checking participation on-chain…
          </p>
        )}
        {closeOptions?.totalParticipants === 0 && (
          <div className="grid gap-3 rounded-[10px] border border-rule bg-sunk p-4 text-small">
            <p className="font-semibold text-ink">Nobody joined. Closing locks the reward for 30 days before you can take it back.</p>
            {closeOptions.canCancel && (
              <>
                <p className="text-ink-2">
                  {isNFT
                    ? 'Cancel instead and your NFTs can be withdrawn right away, with no 30-day wait.'
                    : 'Cancel instead and the reward comes back to you straight away, in the same transaction.'}
                </p>
                <div>
                  <Button variant="secondary" size="sm" onClick={handleCancelInstead} loading={isCancelling} disabled={isClosing}>
                    {isCancelling ? 'Cancelling…' : 'Cancel campaign instead'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        <AlertDialogFooter>
          {/* "Not now", not "Cancel": next to "Cancel campaign instead", a bare "Cancel" reads as
              the on-chain action rather than dismissing the dialog. */}
          <AlertDialogCancel className={buttonClass({ variant: 'secondary' })} disabled={busy}>
            Not now
          </AlertDialogCancel>
          <Button variant="danger" onClick={handleClose} loading={isClosing} disabled={isCancelling}>
            {isClosing ? 'Closing…' : 'Close campaign'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
