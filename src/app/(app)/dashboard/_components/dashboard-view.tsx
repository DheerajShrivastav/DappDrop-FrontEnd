'use client'

import { useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import type { Campaign } from '@/lib/types'
// Direct module imports, not the '@/components/app' barrel: the barrel pulls every primitive
// (ScheduleField's calendar, ClaimActions…) into the route's first load.
import { Button } from '@/components/app/button'
import { CampaignStatusChip } from '@/components/app/chip'
import { EmptyState, ErrorState, LoadingRegion, RowsSkeleton, Skeleton } from '@/components/app/states'
import { PageContainer, PageHeader, SectionHeader } from '@/components/app/page-header'
import { StatRow } from '@/components/app/stat-row'
import { plural, shortAddress } from '@/components/app/format'
import { dateRange, hostCsv, hostRows, hostStats, type HostRow } from '../_lib/host-actions'

/** Where the visitor stands: drives the in-place states (APP-12: no redirect, no toast). */
export type DashboardGate = 'checking' | 'disconnected' | 'not-host' | 'host'

export type OverviewStats =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; sponsoredClaims: number; humanityExcluded: number }

export type DashboardViewProps = {
  gate: DashboardGate
  address?: string | null
  onConnect?: () => void
  /** null while loading. */
  campaigns: Campaign[] | null
  loadError?: string | null
  onRetry?: () => void
  overview: OverviewStats
  now?: Date
  /** Top-right tag (the fixture route's "Example data"). */
  headerTag?: ReactNode
}

const newCampaign = (
  <Button asChild size="sm">
    <Link href="/create-campaign" prefetch={false}>
      New campaign
    </Link>
  </Button>
)

/**
 * /dashboard (app-design §2.6, mockup dashboard.html): "Your campaigns" + [New campaign], then
 * "Needs you" (one row per required action), the 4 stats and "All campaigns" (a table; stacked
 * rows on a phone) with Download (CSV). Presentational: page.tsx and the dev fixture own the data.
 */
export function DashboardView({ gate, address, onConnect, campaigns, loadError, onRetry, overview, now, headerTag }: DashboardViewProps) {
  const rows = useMemo(() => (campaigns ? hostRows(campaigns, now) : []), [campaigns, now])
  const isHost = gate === 'host'

  const action = (
    <>
      {headerTag}
      {isHost && newCampaign}
    </>
  )

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          address ? (
            <>
              Dashboard · <span title={address} className="normal-case">{shortAddress(address)}</span>
            </>
          ) : (
            'Dashboard'
          )
        }
        title="Your campaigns"
        action={headerTag || isHost ? action : undefined}
      />
      <div className="mt-10 md:mt-12">
        {gate === 'checking' ? (
          <DashboardSkeleton />
        ) : gate === 'disconnected' ? (
          <EmptyState
            title="Connect the wallet you host with."
            body="Your dashboard lists the campaigns this wallet hosts and what each one needs next. Connecting only shares your address; nothing is sent until you approve it in your wallet."
            action={
              <>
                <Button onClick={onConnect}>Connect wallet</Button>
                <p className="flex min-h-12 items-center text-small text-ink-2">
                  Not a host yet?&nbsp;
                  <Link href="/create-campaign" prefetch={false} className="dd-link">
                    Start a campaign
                  </Link>
                </p>
              </>
            }
          />
        ) : gate === 'not-host' ? (
          <EmptyState
            title="This wallet doesn’t host any campaigns yet."
            body="Becoming a host is one transaction, once per wallet. Then the wizard walks you through your first campaign."
            action={
              <Button asChild>
                <Link href="/create-campaign" prefetch={false}>
                  Start a campaign
                </Link>
              </Button>
            }
          />
        ) : loadError ? (
          <ErrorState
            title="We couldn’t load your campaigns."
            reason={`${loadError} Nothing is shown instead of guessing.`}
            action={onRetry && <Button onClick={onRetry}>Try again</Button>}
          />
        ) : campaigns === null ? (
          <DashboardSkeleton />
        ) : campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet." body="Your first one takes about 5 minutes." action={<Button asChild>{newCampaignLink}</Button>} />
        ) : (
          <HostDashboard rows={rows} overview={overview} />
        )}
      </div>
    </PageContainer>
  )
}

const newCampaignLink = (
  <Link href="/create-campaign" prefetch={false}>
    New campaign
  </Link>
)

function DashboardSkeleton() {
  return (
    <LoadingRegion label="Loading your campaigns" className="grid gap-12">
      <div className="grid gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[5.5rem] w-full rounded-[10px]" />
      </div>
      <div className="grid grid-cols-2 gap-6 border-y border-rule py-5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-14" />
          </div>
        ))}
      </div>
      <RowsSkeleton count={4} />
    </LoadingRegion>
  )
}

function HostDashboard({ rows, overview }: { rows: HostRow[]; overview: OverviewStats }) {
  const needs = rows.filter((r) => r.next.needsYou)
  const stats = hostStats(rows)

  const download = () => {
    const blob = new Blob([hostCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dappdrop-campaigns-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const overviewValue = (pick: (o: Extract<OverviewStats, { status: 'ok' }>) => number) =>
    overview.status === 'ok' ? pick(overview).toLocaleString('en-US') : overview.status === 'loading' ? <Skeleton className="inline-block h-11 w-12 align-middle" /> : null

  return (
    <div className="grid gap-14">
      <section aria-labelledby="needs-h">
        <SectionHeader id="needs-h" title="Needs you" note={needs.length ? plural(needs.length, 'thing') : 'Nothing right now'} />
        {needs.length === 0 ? (
          <p className="pt-4 text-small text-ink-2">Every campaign is on schedule. Anything that needs you shows up here first.</p>
        ) : (
          <ul className="mt-4 divide-y divide-rule rounded-[10px] border border-rule bg-surface">
            {needs.map(({ campaign, status, next, fundedDraft }) => (
              <li key={campaign.id} className="grid gap-x-6 gap-y-3 p-5 md:grid-cols-[13rem_minmax(0,1fr)_auto] md:items-center md:px-6">
                <div>
                  <CampaignStatusChip status={status} hostFundedDraft={fundedDraft} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-body font-semibold text-ink [overflow-wrap:anywhere]">{campaign.title || `Campaign #${campaign.id}`}</h3>
                  <p className="mt-1 text-small text-ink-2">{next.needsYou!.detail}</p>
                </div>
                <Button asChild size="sm" variant={needs[0].campaign.id === campaign.id ? 'primary' : 'secondary'} className="justify-self-start">
                  <Link href={`/campaign/${campaign.id}`} prefetch={false}>
                    {next.needsYou!.action}
                    <span className="sr-only">: {campaign.title || `campaign #${campaign.id}`}</span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StatRow
        label="Your campaigns in numbers"
        stats={[
          { label: 'Campaigns', value: stats.campaigns.toLocaleString('en-US') },
          { label: 'Open now', value: stats.openNow.toLocaleString('en-US') },
          {
            label: 'Participants',
            value: stats.participants.toLocaleString('en-US'),
            note:
              overview.status === 'ok' && overview.humanityExcluded > 0
                ? `${overview.humanityExcluded.toLocaleString('en-US')} left off by the humanity check`
                : undefined,
          },
          { label: 'Gas-free claims', value: overviewValue((o) => o.sponsoredClaims) },
        ]}
      />

      <section aria-labelledby="all-h">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-[0.9rem]">
          <h2 id="all-h" className="dd-display dd-h2 text-ink">
            All campaigns
          </h2>
          <Button variant="ghost" size="sm" className="px-0" onClick={download}>
            Download (CSV)
          </Button>
        </div>

        {/* Desktop: a table. Phone: stacked rows (the table is display:none there, so it's not read twice). */}
        <table className="w-full border-collapse text-left max-md:hidden">
          <caption className="sr-only">All your campaigns, with what each needs next</caption>
          <thead>
            <tr className="border-b border-rule">
              {['Campaign', 'Status', 'Participants', 'Dates', 'Next'].map((h) => (
                <th key={h} scope="col" className="dd-eyebrow py-4 pr-4 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ campaign, status, next, fundedDraft }) => (
              <tr key={campaign.id} className="border-b border-rule">
                <th scope="row" className="py-4 pr-4 text-body font-medium text-ink">
                  <Link href={`/campaign/${campaign.id}`} prefetch={false} className="dd-link [overflow-wrap:anywhere]">
                    {campaign.title || `Campaign #${campaign.id}`}
                  </Link>
                </th>
                <td className="py-4 pr-4">
                  <CampaignStatusChip status={status} hostFundedDraft={fundedDraft} />
                </td>
                <td className="py-4 pr-4 font-mono text-small text-ink">{campaign.participants.toLocaleString('en-US')}</td>
                <td className="whitespace-nowrap py-4 pr-4 font-mono text-small text-ink">{dateRange(campaign.startDate, campaign.endDate)}</td>
                <td className="py-4 text-small text-ink-2">{next.next}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="md:hidden">
          {rows.map(({ campaign, status, next, fundedDraft }) => (
            <li key={campaign.id} className="grid gap-2 border-b border-rule py-4">
              <Link href={`/campaign/${campaign.id}`} prefetch={false} className="dd-link w-fit text-body font-medium text-ink [overflow-wrap:anywhere]">
                {campaign.title || `Campaign #${campaign.id}`}
              </Link>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <CampaignStatusChip status={status} hostFundedDraft={fundedDraft} />
                <span className="font-mono text-small text-ink">
                  <span className="text-ink-3">Joined</span> {campaign.participants.toLocaleString('en-US')}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-small">
                <span className="font-mono text-ink">
                  <span className="text-ink-3">Dates</span> {dateRange(campaign.startDate, campaign.endDate)}
                </span>
                <span className="text-ink-2">{next.next}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
