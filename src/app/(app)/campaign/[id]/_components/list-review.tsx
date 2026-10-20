'use client'

import type { ReactNode } from 'react'
import { shortDateTime, ROOT_DISPUTE_WINDOW_MS } from '@/lib/campaign-status'
import { Button, ConfirmDialog, Skeleton, plural, shortAddress } from '@/components/app'

export type ListReviewRow = { key: string; wallet: string; cells: ReactNode[] }

/**
 * The host's propose → check → publish flow for a reward list (FR-M3), shared by the ERC20 and
 * NFT settlement panels (each keeps its own data and transactions). Shown inline in "Your next
 * steps": the list's state in words, a summary, the table, wallets left off by the humanity
 * check, then [Propose the list] / [Publish the list]. Publishing a different list than the live
 * one asks first: the 24 hours restart for everyone.
 */
export function ListReview({
  isLoading,
  allocation,
  summary,
  columns,
  rows,
  excluded,
  isClosed,
  isProposing,
  isPublishing,
  onPropose,
  onPublish,
  republishOpen,
  onRepublishOpenChange,
  onConfirmRepublish,
}: {
  isLoading: boolean
  allocation: { version: number; status: 'PROPOSED' | 'PUBLISHED' | 'SUPERSEDED'; publishedAt: string | null } | null
  summary?: string
  columns: string[]
  rows: ListReviewRow[]
  excluded?: string[]
  isClosed: boolean
  isProposing: boolean
  isPublishing: boolean
  onPropose: () => void
  onPublish: () => void
  republishOpen: boolean
  onRepublishOpenChange: (open: boolean) => void
  onConfirmRepublish: () => void
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
    )
  }

  const claimsOpen = allocation?.publishedAt ? new Date(new Date(allocation.publishedAt).getTime() + ROOT_DISPUTE_WINDOW_MS) : null

  return (
    <div className="grid gap-4" data-list-review>
      {allocation?.status === 'PUBLISHED' && (
        <p className="text-small text-ink">
          <span aria-hidden="true" className="mr-1.5 font-mono text-signal">
            ✓
          </span>
          Version {allocation.version} is published.{' '}
          {claimsOpen ? `Claims open ${shortDateTime(claimsOpen)}.` : 'Claims open once the 24-hour review is over.'}
        </p>
      )}
      {allocation?.status === 'PROPOSED' && (
        <p className="text-small text-ink">
          <span aria-hidden="true" className="mr-1.5 font-mono font-semibold text-signal">
            !
          </span>
          Version {allocation.version} is proposed, not published. Nothing is claimable until you publish it.
        </p>
      )}

      {allocation ? (
        <>
          {summary && <p className="text-[0.8125rem] text-ink-2">{summary}</p>}
          <div className="cp-scroll" tabIndex={0} role="region" aria-label="The proposed reward list">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-rule">
                  {columns.map((c, i) => (
                    <th key={c} scope="col" className={i === columns.length - 1 ? 'px-4 py-2 text-right' : 'px-4 py-2'}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-rule font-mono text-[0.8125rem] last:border-0">
                    <td className="px-4 py-2" title={r.wallet}>
                      {shortAddress(r.wallet)}
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={i} className={i === r.cells.length - 1 ? 'px-4 py-2 text-right' : 'px-4 py-2'}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {excluded && excluded.length > 0 && (
            <div className="grid gap-2 rounded-[10px] border border-rule bg-sunk p-4">
              <p className="text-small text-ink">
                <span aria-hidden="true" className="mr-1.5 font-mono font-semibold text-signal">
                  !
                </span>
                {plural(excluded.length, 'wallet')} left off by the humanity check: they finished every task but aren’t verified as human, and this campaign
                requires it. Check that’s what you want before publishing.
              </p>
              <ul className="grid gap-1 font-mono text-[0.8125rem] text-ink-2">
                {excluded.map((w) => (
                  <li key={w} title={w}>
                    {shortAddress(w)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-small text-ink-2">No list proposed yet.</p>
      )}

      {isClosed ? (
        <p className="text-small text-ink-2">The campaign is closed, so the list is frozen. Participants can still claim until the 30 days are over.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button variant={allocation ? 'secondary' : 'primary'} size="sm" onClick={onPropose} loading={isProposing}>
            {isProposing ? 'Proposing…' : allocation ? 'Propose it again' : 'Propose the list'}
          </Button>
          {allocation?.status === 'PROPOSED' && (
            <Button size="sm" onClick={onPublish} loading={isPublishing}>
              {isPublishing ? 'Publishing…' : 'Publish the list'}
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={republishOpen}
        onOpenChange={onRepublishOpenChange}
        title="Publish a corrected list?"
        body="Publishing a different list restarts the 24-hour review for everyone. All claims wait another 24 hours, including wallets whose reward didn’t change."
        confirmLabel="Publish the corrected list"
        onConfirm={onConfirmRepublish}
      />
    </div>
  )
}
