'use client'

import { cn } from '@/lib/utils'

export type TierFooter = { tone: 'muted' | 'warn'; text: string } | null

/**
 * Under a tier editor: the live rule check (the same one the schema enforces, shown as the host
 * types rather than only on Continue), the tiers in the order they'll be submitted, and a payout
 * total against the pool. A broken rule is an error (red); a pool that may not cover every tier
 * is a warning (gold `!`).
 */
export function TierSummary({
  problem,
  schemaMessage,
  rows,
  footer,
}: {
  problem: string | null
  schemaMessage?: string
  rows: { label: string; value: string }[]
  footer: TierFooter
}) {
  const message = problem ?? schemaMessage
  return (
    <div className="grid gap-2" aria-live="polite">
      {message && (
        <p className="flex items-baseline gap-1.5 text-[0.8125rem] leading-snug text-danger">
          <span aria-hidden="true" className="font-mono font-semibold">
            !
          </span>
          <span>{message}</span>
        </p>
      )}
      {rows.length > 0 && !problem && (
        <div className="rounded-md border border-rule bg-sunk px-4 py-3">
          <p className="dd-eyebrow mb-1">Payout preview</p>
          <dl className="dd-kv">
            {rows.map((r, i) => (
              <div key={i}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
          {footer && (
            <p className={cn('mt-2 flex items-start gap-2 border-t border-rule pt-3 text-[0.8125rem] leading-snug', footer.tone === 'warn' ? 'text-ink' : 'text-ink-2')}>
              {footer.tone === 'warn' && (
                <span aria-hidden="true" className="font-mono font-semibold text-signal">
                  !
                </span>
              )}
              <span>{footer.text}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
