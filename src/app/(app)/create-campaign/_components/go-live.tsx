'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/app'
import { OpenExpiredCampaignDialog } from '@/components/open-expired-campaign-dialog'
import { EXPIRED_OPEN_WARNING, hasEndTimePassed } from '@/lib/campaign-timing'
import { Notice } from './wizard-ui'

/**
 * The created phase (FR-H6, app-design §2.5): "Your campaign is a draft. Open it now, or later
 * from your dashboard." Open stays a separate, explicit action; a completed Draft can sit
 * indefinitely (FR-H7) via [Not now]. Moved from page.tsx; the logic is unchanged.
 */
export function GoLiveChecklist({
  campaignId,
  endDate,
  isOpening,
  onOpen,
  onLater,
}: {
  campaignId: string
  /** The end time submitted on-chain (the wizard's `dates.to`). */
  endDate?: Date
  isOpening: boolean
  onOpen: () => void
  onLater: () => void
}) {
  // Re-evaluated every 30s: a host can sit on this screen past the end time (the minimum
  // campaign is only 1 hour), and the checklist must not keep claiming the times are fine.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  const [confirmExpiredOpen, setConfirmExpiredOpen] = useState(false)
  const endPassed = endDate ? hasEndTimePassed(endDate, now) : false

  const rows: { done: boolean; text: string }[] = [
    { done: true, text: 'Tasks added' },
    { done: true, text: 'Reward configured and funded' },
    endPassed ? { done: false, text: 'The end time has passed' } : { done: true, text: 'Start and end times are valid' },
  ]

  return (
    <section className="grid max-w-[44rem] gap-6" aria-label="Open the campaign" data-go-live>
      <p className="text-body text-ink-2">
        Campaign <span className="font-mono text-ink">#{campaignId}</span> is created and funded. It’s a draft: participants can’t see or join it until you open it.
      </p>
      <ul className="border-y border-rule">
        {rows.map((r) => (
          <li key={r.text} className="flex items-baseline gap-3 border-t border-rule py-3 first:border-t-0">
            <span aria-hidden="true" className="w-4 font-mono font-semibold text-signal">
              {r.done ? '✓' : '!'}
            </span>
            <span className="text-ink">{r.text}</span>
          </li>
        ))}
      </ul>
      {endPassed && (
        <Notice tone="attention" title="The end time has passed">
          {EXPIRED_OPEN_WARNING}
        </Notice>
      )}
      <OpenExpiredCampaignDialog open={confirmExpiredOpen} onOpenChange={setConfirmExpiredOpen} onConfirm={onOpen} />
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            // Re-check at click time, not just render time: the interval can be up to 30s stale.
            if (endDate && hasEndTimePassed(endDate)) setConfirmExpiredOpen(true)
            else onOpen()
          }}
          loading={isOpening}
        >
          {isOpening ? 'Opening…' : 'Open campaign'}
        </Button>
        <Button variant="secondary" onClick={onLater}>
          Not now
        </Button>
      </div>
    </section>
  )
}
