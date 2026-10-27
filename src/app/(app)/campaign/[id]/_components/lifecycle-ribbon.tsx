import type { ReactNode } from 'react'
import type { Campaign } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { cn } from '@/lib/utils'
import { ribbonStops } from './campaign-model'

/**
 * "Where this campaign is" (§2.2): the lifecycle as a row of stops (past ✓ · the current stop in
 * gold · what comes later), then the status model's one honest detail line. On a phone it goes
 * vertical with a left hairline and "→" on the current stop (campaign.css).
 *
 * `action` sits after the detail line: "Record the end" for any connected wallet once the end
 * time has passed (the contract's endCampaign is permissionless then).
 */
export function LifecycleRibbon({ campaign, status, action }: { campaign: Campaign; status: CampaignStatusInfo; action?: ReactNode }) {
  const stops = ribbonStops(campaign, status)
  return (
    <section className="cp-ribbon-wrap" aria-labelledby="cp-where">
      <h2 id="cp-where" className="dd-eyebrow">
        Where this campaign is
      </h2>
      <ol className="cp-ribbon" aria-labelledby="cp-where">
        {stops.map((s) => (
          <li key={s.key} className={cn(s.state === 'past' && 'is-past', s.state === 'now' && 'is-now')} aria-current={s.state === 'now' ? 'step' : undefined}>
            <span className="cp-stop">{s.label}</span>
            {s.state === 'past' && <span className="sr-only"> (done)</span>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="max-w-[70ch] text-small text-ink-2">{status.detail}</p>
        {action}
      </div>
    </section>
  )
}
