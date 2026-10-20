'use client'

import type { ReactNode } from 'react'
import type { Campaign } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { displayImageUrl } from '@/lib/campaign-image'
import { network } from '@/config/landing'
import { CampaignStatusChip, PageHeader, PayoutChip, shortAddress } from '@/components/app'

/**
 * The campaign page header (§2.2 / §2.3): ← back · the chip row (state · payout) · the serif H1 ·
 * the description · a mono meta line. Typographic by default; when the host uploaded a cover it
 * shows as a 16:7 band above the chips (never a placeholder, never text on an image).
 */
export function CampaignHeader({
  campaign,
  status,
  hostView,
  extraChips,
  hostToggle,
}: {
  campaign: Campaign
  status: CampaignStatusInfo
  /** The host's own view: "← Your campaigns", the escrow link and the view toggle in the meta. */
  hostView: boolean
  /** Fixture pages add an "Example" chip. */
  extraChips?: ReactNode
  /** "View as a participant" / "Back to your host view" (host only). */
  hostToggle?: ReactNode
}) {
  const cover = displayImageUrl(campaign.imageUrl)
  const short = campaign.description?.trim()
  const long = campaign.longDescription?.trim()
  const lead = short || long
  const body = long && long !== lead ? long : null
  const explorer = network.explorer
  const escrowUrl = explorer && network.entrypoint ? `${explorer}/address/${network.entrypoint}` : ''
  const hostUrl = explorer ? `${explorer}/address/${campaign.host}` : ''
  const where = `Campaign #${campaign.id} on ${network.name}`

  return (
    <div>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- host-uploaded covers from any host; the band reserves its space (16:7).
        <img src={cover} alt="" className="cp-cover" decoding="async" />
      )}
      <PageHeader
        size="md"
        back={hostView ? { href: '/dashboard', label: 'Your campaigns' } : { href: '/campaigns', label: 'Campaigns' }}
        chips={
          <>
            <CampaignStatusChip status={status} />
            <PayoutChip mode={campaign.settlement?.mode} />
            {extraChips}
          </>
        }
        title={campaign.title}
        lead={lead || undefined}
        meta={
          hostView ? (
            <>
              <span>{where}</span>
              {escrowUrl && (
                <a className="dd-link" href={escrowUrl} target="_blank" rel="noopener noreferrer">
                  Escrow contract ↗
                </a>
              )}
              {hostToggle}
            </>
          ) : (
            <>
              <span>
                Hosted by{' '}
                {hostUrl ? (
                  <a className="dd-link" href={hostUrl} target="_blank" rel="noopener noreferrer" title={campaign.host}>
                    {shortAddress(campaign.host)} ↗
                  </a>
                ) : (
                  <span title={campaign.host}>{shortAddress(campaign.host)}</span>
                )}
              </span>
              <span>{where}</span>
              {hostToggle}
            </>
          )
        }
      />
      {body && <p className="mt-5 max-w-[65ch] whitespace-pre-line text-body text-ink-2 [overflow-wrap:anywhere]">{body}</p>}
    </div>
  )
}
