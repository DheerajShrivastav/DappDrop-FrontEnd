'use client'

import { useEffect, useState } from 'react'
import type { Campaign } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { shortDate, shortDateTime } from '@/lib/campaign-status'
import { rewardDisplayLabel } from '@/lib/campaign-lifecycle'
import { network, networkLabel } from '@/config/landing'
import { Button } from '@/components/app/button'
import { KeyValueList, type KeyValueItem } from '@/components/app/kv-list'
import { Panel } from '@/components/app/panel'
import { payoutShortLabel } from '@/components/app/chip-map'
import { dateRange, isTieredMode, listDueBy } from './campaign-model'

function participantsValue(campaign: Campaign): string {
  const cap = campaign.settlement?.maxParticipants ?? 0
  const n = campaign.participants.toLocaleString('en-US')
  return cap > 0 ? `${n} of ${cap.toLocaleString('en-US')}` : n
}

function ranLabel(status: CampaignStatusInfo): string {
  if (status.state === 'draft' || status.state === 'upcoming') return 'Runs'
  if (status.state === 'open') return 'Runs'
  return 'Ran'
}

/**
 * The participant rail (§2.2): "The campaign" facts, the escrow contract on the explorer, then
 * Copy campaign link and Refresh. Every value is read from the chain or the indexer; unknowns are
 * left out (never "TBD").
 */
export function CampaignFacts({
  campaign,
  status,
  onCopyLink,
  onRefresh,
  isRefreshing,
}: {
  campaign: Campaign
  status: CampaignStatusInfo
  onCopyLink: () => void
  onRefresh: () => void
  isRefreshing: boolean
}) {
  const payout = payoutShortLabel(campaign.settlement?.mode)
  const items: KeyValueItem[] = [
    { label: 'Reward', value: rewardDisplayLabel(campaign) },
    ...(payout ? [{ label: 'Payout', value: payout }] : []),
    { label: 'Participants', value: participantsValue(campaign) },
    { label: ranLabel(status), value: dateRange(new Date(campaign.startDate), new Date(campaign.endDate)), title: `${shortDateTime(new Date(campaign.startDate))} – ${shortDateTime(new Date(campaign.endDate))}` },
    ...(status.claimsOpenAt
      ? [{ label: status.claimsOpenAt.getTime() <= Date.now() ? 'Claims opened' : 'Claims open', value: shortDateTime(status.claimsOpenAt) }]
      : []),
    ...(status.state === 'closed_claimable' && status.sweepEligibleAt ? [{ label: 'Claim by', value: shortDate(status.sweepEligibleAt) }] : []),
    { label: 'Network', value: networkLabel },
  ]
  const escrowUrl = network.explorer && network.entrypoint ? `${network.explorer}/address/${network.entrypoint}` : ''
  return (
    <>
      <Panel as="section" aria-labelledby="cp-facts" pad={false} className="p-5 md:p-6">
        <h2 id="cp-facts" className="dd-eyebrow mb-[0.6rem]">
          The campaign
        </h2>
        <KeyValueList items={items} />
        {escrowUrl && (
          <p className="mt-4 text-[0.8125rem]">
            <a className="dd-link" href={escrowUrl} target="_blank" rel="noopener noreferrer">
              Escrow contract on Etherscan ↗
            </a>
          </p>
        )}
      </Panel>
      <Button variant="secondary" size="sm" block onClick={onCopyLink}>
        Copy campaign link
      </Button>
      <Button variant="ghost" size="sm" onClick={onRefresh} loading={isRefreshing} className="justify-self-center">
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </Button>
    </>
  )
}

type Funnel = { joined: number; tasksStarted: number; qualified: number; claimed: number }

/**
 * The host rail (§2.3): Participation as hairline bars (joined → finished every required task →
 * claimed), then the key dates and the CSV downloads. Joined comes from the chain; the rest from
 * /api/campaigns/:id/analytics. If that doesn't answer, the bars say "Couldn't load", never 0.
 */
export function HostRail({ campaign, status }: { campaign: Campaign; status: CampaignStatusInfo }) {
  const [funnel, setFunnel] = useState<Funnel | null | 'error'>(null)
  const ended = campaign.status === 'Ended' || campaign.status === 'Closed'

  useEffect(() => {
    if (!ended) return
    let cancelled = false
    fetch(`/api/campaigns/${campaign.id}/analytics`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setFunnel(d.funnel ?? 'error'))
      .catch(() => !cancelled && setFunnel('error'))
    return () => {
      cancelled = true
    }
  }, [campaign.id, ended])

  const joined = campaign.participants
  const rows: { label: string; value: number | null; pending?: string }[] = [
    { label: 'Joined', value: joined },
    { label: 'Finished every required task', value: !ended ? null : funnel && funnel !== 'error' ? funnel.qualified : null, pending: !ended ? 'after the end' : undefined },
    { label: 'Claimed', value: !ended ? null : funnel && funnel !== 'error' ? funnel.claimed : null, pending: !ended ? 'not yet' : undefined },
  ]
  const listMode = !isTieredMode(campaign.settlement?.mode)
  const kv: KeyValueItem[] = [
    { label: 'Reward', value: rewardDisplayLabel(campaign) },
    { label: ranLabel(status), value: dateRange(new Date(campaign.startDate), new Date(campaign.endDate)) },
    ...(listMode && (status.state === 'ended_finalizing' || status.state === 'overdue_fallback') ? [{ label: 'List due by', value: shortDate(listDueBy(campaign)) }] : []),
    ...(status.sweepEligibleAt ? [{ label: 'Take back from', value: shortDate(status.sweepEligibleAt) }] : []),
  ]

  return (
    <Panel as="section" aria-labelledby="cp-participation" pad={false} className="p-5 md:p-6">
      <h2 id="cp-participation" className="dd-eyebrow mb-[0.9rem]">
        Participation
      </h2>
      <div className="grid gap-[0.9rem]">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-[0.35rem] text-small">
            <span className="text-ink-2">{r.label}</span>
            <span className="font-mono text-ink">
              {r.value !== null ? (
                r.value.toLocaleString('en-US')
              ) : r.pending ? (
                <span className="text-ink-2">{r.pending}</span>
              ) : funnel === 'error' ? (
                <span className="text-ink-2" title="Couldn’t load">
                  —<span className="sr-only"> (couldn’t load)</span>
                </span>
              ) : (
                <span className="text-ink-2">…</span>
              )}
            </span>
            <span className="cp-bar" aria-hidden="true">
              <i style={{ width: `${joined > 0 && r.value !== null ? Math.round((r.value / joined) * 100) : 0}%` }} />
            </span>
          </div>
        ))}
      </div>
      <KeyValueList items={kv} className="mt-5 border-t border-rule pt-1" />
      {ended && (
        <div className="mt-4 grid gap-2 text-[0.8125rem]">
          <a className="dd-link w-fit" href={`/api/campaigns/${campaign.id}/analytics/export/funnel`} download>
            Download the participation (CSV)
          </a>
          {listMode && (
            <a className="dd-link w-fit" href={`/api/campaigns/${campaign.id}/analytics/export/allocation`} download>
              Download the reward list (CSV)
            </a>
          )}
        </div>
      )}
    </Panel>
  )
}
