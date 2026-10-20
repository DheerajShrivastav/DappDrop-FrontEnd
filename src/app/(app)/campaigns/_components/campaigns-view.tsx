'use client'

import { useId, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { Campaign } from '@/lib/types'
import { getCampaignStatus } from '@/lib/campaign-status'
import { Button, CampaignStatusChip, EmptyState, ErrorState, Input, NativeSelect, PageContainer, PageHeader, Segmented } from '@/components/app'
import { CampaignCard } from '@/components/campaign-card'
import { CAMPAIGN_GRID, CampaignGridSkeleton } from '@/components/campaign-card-skeleton'
import { cn } from '@/lib/utils'
import {
  DEFAULT_FILTERS,
  PAYOUT_FILTERS,
  REWARD_FILTERS,
  SORTS,
  STATUS_BUCKETS,
  applyDiscoveryFilters,
  filtersActive,
  type DiscoveryFilters,
  type PayoutFilter,
  type RewardFilter,
  type SortKey,
  type StatusBucket,
} from '../_lib/discovery'
import type { WalletReward } from '../_lib/use-wallet-rewards'

export type CampaignsViewProps = {
  /** Campaigns shown by default (the hidden test runs already taken out). */
  listed: Campaign[]
  /** The hidden internal test runs (src/config/hidden-campaigns.ts). */
  hidden: Campaign[]
  loading: boolean
  /** A load failure, in plain words; renders the error state with [Try again]. */
  error?: string | null
  onRetry?: () => void
  /** Campaign ids this connected wallet joined. */
  joined?: ReadonlySet<string>
  /** Rewards this wallet can claim now (drives the strip and the gold card line). */
  rewards?: WalletReward[]
  /** Fixed clock (fixtures, tests). */
  now?: Date
  /** Something to show at the top right of the header (the fixture route's "Example data" tag). */
  headerTag?: ReactNode
}

/**
 * /campaigns (app-design §2.1, mockup campaigns.html): the page header, the "you have a reward
 * to claim" strip, the filters, the curation line and the card grid, with the loading, empty,
 * no-match and error states. Presentational: page.tsx (and the dev fixture route) own the data.
 */
export function CampaignsView({ listed, hidden, loading, error, onRetry, joined, rewards = [], now, headerTag }: CampaignsViewProps) {
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS)
  const [showHidden, setShowHidden] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreId = useId()
  const set = <K extends keyof DiscoveryFilters>(k: K, v: DiscoveryFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))

  const pool = useMemo(() => (showHidden ? [...listed, ...hidden] : listed), [listed, hidden, showHidden])
  const { results, counts } = useMemo(() => applyDiscoveryFilters(pool, filters, now), [pool, filters, now])
  const rewardById = useMemo(() => new Map(rewards.map((r) => [r.campaignId, r])), [rewards])
  const byId = useMemo(() => new Map([...listed, ...hidden].map((c) => [c.id, c])), [listed, hidden])

  const nothingLive = !loading && !error && listed.length === 0
  const clear = () => setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort }))

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Campaigns · Sepolia testnet"
        title="Campaigns"
        lead="Join a campaign, complete its tasks, and claim from escrow once it ends. Everything here runs on Sepolia testnet, so rewards are test tokens."
        action={headerTag}
      />

      {rewards.length > 0 && (
        <ClaimStrips
          items={rewards
            .map((r) => ({ reward: r, campaign: byId.get(r.campaignId) }))
            .filter((x): x is { reward: WalletReward; campaign: Campaign } => Boolean(x.campaign))}
          now={now}
        />
      )}

      {/* Filters: search · status (with counts) · reward · payout. On a phone: search, then
          Status + "More filters" (a disclosure with reward, payout and sort). */}
      <form role="search" aria-label="Filter campaigns" className="mt-10 grid gap-3" onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-[1_1_16rem]">
            <span className="sr-only">Search campaigns</span>
            <Input type="search" placeholder="Search campaigns" value={filters.search} onChange={(e) => set('search', e.target.value)} />
          </label>
          <Segmented
            className="max-md:hidden"
            label="Status"
            hideLabel
            value={filters.status}
            onChange={(v) => set('status', v)}
            options={STATUS_BUCKETS.map((b) => ({ value: b.value, label: `${b.label} · ${counts[b.value]}` }))}
          />
          <div className="max-md:hidden flex flex-wrap gap-3">
            <SelectBox label="Reward" value={filters.reward} onChange={(v) => set('reward', v as RewardFilter)} options={REWARD_FILTERS} />
            <SelectBox label="Payout" value={filters.payout} onChange={(v) => set('payout', v as PayoutFilter)} options={PAYOUT_FILTERS} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:hidden">
          <SelectBox
            label="Status"
            value={filters.status}
            onChange={(v) => set('status', v as StatusBucket)}
            options={STATUS_BUCKETS.map((b) => ({ value: b.value, label: b.value === 'all' ? `Status: all · ${counts.all}` : `${b.label} · ${counts[b.value]}` }))}
          />
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((o) => !o)}
            className="flex h-12 items-center justify-between gap-2 rounded-md border border-rule-strong bg-sunk px-[0.9rem] text-left text-[0.9375rem] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            More filters
            <span aria-hidden="true" className={cn('h-2 w-2 rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-2 transition-transform', moreOpen ? 'translate-y-[30%] rotate-[225deg]' : '-translate-y-[30%]')} />
          </button>
        </div>
        <div id={moreId} className={cn('grid gap-3 md:hidden', !moreOpen && 'hidden')}>
          <SelectBox label="Reward" value={filters.reward} onChange={(v) => set('reward', v as RewardFilter)} options={REWARD_FILTERS} />
          <SelectBox label="Payout" value={filters.payout} onChange={(v) => set('payout', v as PayoutFilter)} options={PAYOUT_FILTERS} />
          <SelectBox label="Sort" value={filters.sort} onChange={(v) => set('sort', v as SortKey)} options={SORTS} />
        </div>
      </form>

      {/* The curation line (and, on desktop, the sort). */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-[0.8125rem] text-ink-3" aria-live="polite">
          {!loading && hidden.length > 0 && (
            <>
              {showHidden
                ? `Showing ${hidden.length} internal test ${hidden.length === 1 ? 'run' : 'runs'} too · `
                : `Curated list. ${hidden.length} internal test ${hidden.length === 1 ? 'run is' : 'runs are'} hidden · `}
              <button type="button" className="dd-link inline-flex min-h-6 items-center text-ink-2" aria-pressed={showHidden} onClick={() => setShowHidden((v) => !v)}>
                {showHidden ? 'Hide them' : 'Show them'}
              </button>
            </>
          )}
        </p>
        <div className="max-md:hidden w-[15rem]">
          <SelectBox label="Sort" value={filters.sort} onChange={(v) => set('sort', v as SortKey)} options={SORTS} />
        </div>
      </div>

      <section aria-label="Campaign list" className="mt-6">
        {loading ? (
          <CampaignGridSkeleton />
        ) : error ? (
          <ErrorState
            title="We couldn’t load campaigns."
            reason={`The campaign index didn’t answer: ${error} Nothing is shown instead of guessing.`}
            action={onRetry && <Button onClick={onRetry}>Try again</Button>}
          />
        ) : nothingLive && !showHidden ? (
          <EmptyState
            title="No live campaigns yet."
            body={
              <>
                Hosts are setting up their first ones on Sepolia testnet. Read{' '}
                <Link href="/how-it-works" className="dd-link">
                  how it works
                </Link>{' '}
                while you wait.
              </>
            }
            action={
              <Button asChild>
                <Link href="/create-campaign" prefetch={false}>
                  Start a campaign
                </Link>
              </Button>
            }
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="No campaigns match."
            body={filtersActive(filters) ? 'Nothing fits this search and these filters.' : 'There’s nothing to show here yet.'}
            action={
              filtersActive(filters) && (
                <Button variant="ghost" onClick={clear}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <ul className={CAMPAIGN_GRID}>
            {results.map((c) => {
              const r = rewardById.get(c.id)
              return (
                <li key={c.id} className="grid">
                  <CampaignCard campaign={c} now={now} joined={joined?.has(c.id)} hasReward={Boolean(r)} rewardLabel={r?.amountLabel} />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  )
}

/** A native select in the field style; the visible option text carries the label ("Reward: any"). */
function SelectBox<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <NativeSelect aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className="min-w-[9.5rem]">
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  )
}

/**
 * "You have a reward to claim" (only for a connected wallet with something claimable now):
 * the chip, the amount and campaign, the deadline when there is one, and [Go to claim →].
 */
function ClaimStrips({ items, now }: { items: { reward: WalletReward; campaign: Campaign }[]; now?: Date }) {
  const shown = items.slice(0, 3)
  return (
    <ul className="mt-10 grid gap-3" aria-label="Rewards you can claim">
      {shown.map(({ reward, campaign }) => {
        // The chip carries the deadline when there is one ("Claim by 15 Nov").
        const status = getCampaignStatus(campaign, now)
        return (
          <li key={campaign.id}>
            <Link
              href={`/campaign/${campaign.id}`}
              prefetch={false}
              className="group flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[10px] border border-rule bg-surface p-4 shadow-[inset_3px_0_0_var(--signal)] transition-colors [transition-duration:var(--dur-short)] can-hover:hover:border-ink-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal md:px-6"
            >
              <CampaignStatusChip status={status} />
              <span className="min-w-0 flex-[1_1_20rem] text-small text-ink [overflow-wrap:anywhere]">
                <strong className="font-semibold">You have a reward to claim:</strong>{' '}
                {reward.amountLabel ? `${reward.amountLabel} from ` : 'from '}“{campaign.title}”.
              </span>
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-rule-strong px-[1.1rem] text-small font-medium text-ink group-hover:border-ink max-sm:w-full max-sm:justify-center">
                Go to claim <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        )
      })}
      {items.length > shown.length && (
        <li className="text-[0.8125rem] text-ink-2">
          And {items.length - shown.length} more: look for the gold “for you” line on the cards below.
        </li>
      )}
    </ul>
  )
}
