'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/app/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Textarea, controlClass } from '@/components/app/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'missing_allocation', label: 'I’m missing from the list' },
  { value: 'wrong_amount', label: 'My amount looks wrong' },
  { value: 'sybil_suspected', label: 'Looks like fake or farmed wallets' },
  { value: 'other', label: 'Other' },
]

/**
 * "Report a concern" (P4 Part 3), deliberately scoped small: files a signal to the host and
 * platform team, nothing more. The required non-blocking copy near submit is load-bearing — do
 * not remove it or soften its meaning, only its wording.
 */
export function ReportConcernDialog({ campaignId, isConnected = true }: { campaignId: string; isConnected?: boolean }) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingReport, setExistingReport] = useState<{
    status: string
    category: string
    reason: string
    hostResponse: string | null
    reviewedAt: string | null
  } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    fetch(`/api/campaigns/${campaignId}/reports`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.myReport) {
          setExistingReport(data.myReport)
          setCategory(data.myReport.category)
          setReason(data.myReport.reason)
        }
      })
      .catch(() => {})
  }, [isOpen, campaignId])

  const handleSubmit = async () => {
    if (!category || !reason.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category, reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit report')
      toast({
        title: existingReport ? 'Report updated' : 'Report sent',
        description: 'The host and the DappDrop team can see it now.',
      })
      setIsOpen(false)
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Your report didn’t go through', description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <button type="button" className="dd-link inline cursor-pointer bg-transparent p-0 font-[inherit] text-[length:inherit]" onClick={() => setIsOpen(true)}>
        Report a concern
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a concern</DialogTitle>
          <DialogDescription>
            {existingReport
              ? 'You already have a report on this list. Sending again updates it.'
              : 'Tell the host and the DappDrop team what looks wrong with the published list.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {existingReport?.status === 'REVIEWED' && (
            <div className="rounded-[10px] border border-rule bg-sunk p-4 text-small">
              <p className="font-semibold text-ink">
                The host reviewed your report
                {existingReport.reviewedAt ? ` on ${new Date(existingReport.reviewedAt).toLocaleDateString()}` : ''}
              </p>
              {existingReport.hostResponse?.trim() ? (
                <p className="mt-1 whitespace-pre-wrap text-ink-2">{existingReport.hostResponse.trim()}</p>
              ) : (
                <p className="mt-1 text-ink-2">They marked it as reviewed without a written reply.</p>
              )}
            </div>
          )}
          <div className="grid gap-2">
            <label htmlFor="report-category" className="text-small font-semibold text-ink">
              What kind of problem?
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="report-category" className={controlClass('justify-between')}>
                <SelectValue placeholder="Choose one" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="report-reason" className="text-small font-semibold text-ink">
              What’s wrong?
            </label>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="The more specific, the easier it is for the host to check."
              maxLength={2000}
              rows={4}
            />
          </div>
          <p className="text-[0.8125rem] text-ink-2">
            Reports go to the host and the DappDrop team. Reporting doesn’t pause claims: the host decides whether to publish a
            corrected list.
          </p>
          {existingReport && (
            <p className="text-[0.8125rem] text-ink-2">
              Updating sets the report back to open, so the host looks again. Any reply the host left stays visible here.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={isSubmitting}>
              Not now
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!isConnected || !category || !reason.trim()}
            disabledReason={!isConnected ? 'Connect your wallet first: a report is tied to the wallet that sends it.' : undefined}
          >
            {isSubmitting ? 'Sending…' : existingReport ? 'Update the report' : 'Send the report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
