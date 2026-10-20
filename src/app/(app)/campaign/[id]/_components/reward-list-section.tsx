'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import type { Campaign } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { shortDateTime } from '@/lib/campaign-status'
import { SectionHeader, Skeleton, plural, shortAddress } from '@/components/app'
import { splitAmount, amountText } from './reward-panel'

type ERC20Entry = { wallet: string; amount: string; tasksCompleted: number }
type NFTEntry = { wallet: string; standard: string | null; tokenId: string | null; amount: string; tasksCompleted: number }
type AllocationSummary = {
  version: number
  root: string
  totalAmount?: string
  totalItems?: number
  decimals?: number | null
  symbol?: string | null
  policy: string
  status: string
  createdAt: string
  publishedAt: string | null
  entries: (ERC20Entry | NFTEntry)[]
}

const WAITING = new Set(['ended_finalizing', 'overdue_fallback'])

/**
 * "The reward list" (§2.2; P4 Part 1, BR-M4): public, no wallet needed, once a list is published.
 * A collapsed summary, [View list] for the table, the CSV, and "Report a concern". Resolves against
 * whichever allocation route has a published list; the API decides what's public (it checks the
 * live on-chain root), this only renders it.
 */
export function RewardListSection({ campaign, status, report }: { campaign: Campaign; status: CampaignStatusInfo; report: ReactNode }) {
  const [allocation, setAllocation] = useState<AllocationSummary | null>(null)
  const [isNFT, setIsNFT] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    Promise.all([
      fetch(`/api/campaigns/${campaign.id}/allocations/latest`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/campaigns/${campaign.id}/nft-allocations/latest`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([erc20, nft]) => {
        if (cancelled) return
        // Only a PUBLISHED list is public. The host's own session also gets their unpublished
        // draft from this route, and "View as a participant" must not show it as the list.
        if (erc20?.allocation?.status === 'PUBLISHED') {
          setAllocation(erc20.allocation)
          setIsNFT(false)
        } else if (nft?.allocation?.status === 'PUBLISHED') {
          setAllocation(nft.allocation)
          setIsNFT(true)
        } else setAllocation(null)
      })
      .catch(() => !cancelled && setAllocation(null))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [campaign.id])

  if (campaign.status !== 'Ended' && campaign.status !== 'Closed') return null

  const published = allocation?.publishedAt ? new Date(allocation.publishedAt) : null
  const header = <SectionHeader id="cp-list-h" title="The reward list" note={published ? `Published ${shortDateTime(published)}` : undefined} />

  if (isLoading) {
    return (
      <section id="cp-list" aria-labelledby="cp-list-h" aria-busy="true">
        {header}
        <div className="border-b border-rule py-5">
          <Skeleton className="h-5 w-2/3" />
        </div>
      </section>
    )
  }

  if (!allocation) {
    if (!WAITING.has(status.state)) return null
    return (
      <section id="cp-list" aria-labelledby="cp-list-h">
        {header}
        <p className="border-b border-rule py-5 text-small text-ink-2">
          No list yet. The host publishes it next; it’s public here for 24 hours before claims open, so anyone can check it.
        </p>
      </section>
    )
  }

  const n = allocation.entries.length
  const amounts = new Set(allocation.entries.map((e) => e.amount))
  const fmt = (raw: string) => formatAmount(raw, allocation.decimals, allocation.symbol)
  const summary = isNFT
    ? `${plural(n, 'wallet')} · one NFT each`
    : amounts.size === 1 && n > 0
      ? `${plural(n, 'wallet')} · ${amountText(splitAmount(fmt([...amounts][0])))} each`
      : `${plural(n, 'wallet')} · ${amountText(splitAmount(fmt(allocation.totalAmount ?? '0')))} in total`

  return (
    <section id="cp-list" aria-labelledby="cp-list-h">
      {header}
      <details className="cp-details border-b border-rule py-3">
        <summary>
          <span className="text-small text-ink">{summary}</span>
          <span className="dd-link shrink-0 text-small">View list</span>
        </summary>
        <div className="mt-3 grid gap-3">
          <div className="cp-scroll" tabIndex={0} role="region" aria-label="The reward list, every wallet">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-rule">
                  <th scope="col" className="px-4 py-2">
                    Wallet
                  </th>
                  {isNFT && (
                    <th scope="col" className="px-4 py-2">
                      Item
                    </th>
                  )}
                  <th scope="col" className="px-4 py-2 text-right">
                    {isNFT ? 'Qty' : 'Amount'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {allocation.entries.map((e) => (
                  <tr key={e.wallet} className="border-b border-rule last:border-0">
                    <td className="px-4 py-2 font-mono text-[0.8125rem]" title={e.wallet}>
                      {shortAddress(e.wallet)}
                    </td>
                    {isNFT && (
                      <td className="px-4 py-2 font-mono text-[0.8125rem]">
                        {(e as NFTEntry).standard} #{(e as NFTEntry).tokenId}
                      </td>
                    )}
                    <td className="px-4 py-2 text-right font-mono text-[0.8125rem]">{isNFT ? e.amount : amountText(splitAmount(fmt(e.amount)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[0.8125rem] text-ink-2">
            Checked against the list’s root on-chain: <span className="font-mono [overflow-wrap:anywhere]">{allocation.root}</span>
          </p>
          <a className="dd-link w-fit text-small" href={`/api/campaigns/${campaign.id}/analytics/export/allocation`} download>
            Download the list (CSV)
          </a>
        </div>
      </details>
      <p className="mt-[0.9rem] text-[0.8125rem] text-ink-2">
        Something wrong with the list? {report}. The host sees it, and only the host can change the list.
      </p>
    </section>
  )
}
