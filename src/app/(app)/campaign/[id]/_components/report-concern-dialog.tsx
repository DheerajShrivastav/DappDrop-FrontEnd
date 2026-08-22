'use client'

import { useEffect, useState } from 'react'
import { Loader2, Flag, MessageSquare } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'missing_allocation', label: "I'm missing an allocation" },
  { value: 'wrong_amount', label: 'My amount looks wrong' },
  { value: 'sybil_suspected', label: 'Suspected sybil / farming' },
  { value: 'other', label: 'Other' },
]

/**
 * "Report a concern" (P4 Part 3), deliberately scoped small: files a signal to the host and
 * platform team, nothing more. The required non-blocking copy near submit is load-bearing — do
 * not remove it or soften its meaning, only its wording.
 */
export function ReportConcernDialog({ campaignId }: { campaignId: string }) {
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
        title: existingReport ? 'Report updated' : 'Report submitted',
        description: 'The host and platform team have been notified.',
      })
      setIsOpen(false)
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not submit report', description: e.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Flag className="mr-2 h-4 w-4" /> Report a concern
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a concern</DialogTitle>
          <DialogDescription>
            {existingReport
              ? 'You already have a report on file for this allocation — submitting again updates it.'
              : 'Tell the host and platform team what looks wrong with the published allocation.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {existingReport?.status === 'REVIEWED' && (
            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertTitle>
                Host reviewed your report
                {existingReport.reviewedAt
                  ? ` on ${new Date(existingReport.reviewedAt).toLocaleDateString()}`
                  : ''}
              </AlertTitle>
              <AlertDescription>
                {existingReport.hostResponse?.trim() ? (
                  <p className="whitespace-pre-wrap">{existingReport.hostResponse.trim()}</p>
                ) : (
                  <p className="text-muted-foreground">
                    The host marked this report as reviewed without leaving a written reply.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="report-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="report-category">
                <SelectValue placeholder="Select a category" />
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
          <div className="space-y-2">
            <Label htmlFor="report-reason">What's wrong?</Label>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue — the more specific, the easier it is for the host to check."
              maxLength={2000}
              rows={4}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Reports are sent to the host and the platform team during the review window.
            Reporting does not pause claims — the host decides whether to publish a corrected
            allocation.
          </p>
          {existingReport && (
            <p className="text-xs text-muted-foreground">
              Updating this report sets it back to open so the host looks again. Any reply the host
              already left stays visible here.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting || !category || !reason.trim()}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existingReport ? 'Update report' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
