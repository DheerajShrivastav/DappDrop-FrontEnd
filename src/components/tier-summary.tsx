'use client'

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TierFooter = { tone: 'muted' | 'warn'; text: string } | null

/**
 * Under a tier editor: the live rule check (the same one the schema enforces, shown as the host
 * types rather than only on Next), the tiers in the order they'll be submitted, and a payout
 * total against the pool.
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
    <div className="space-y-2">
      {message && <p className="text-sm font-medium text-destructive">{message}</p>}
      {rows.length > 0 && !problem && (
        <div className="space-y-1 rounded-md bg-secondary/40 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payout preview</p>
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between gap-4">
              <span>{r.label}</span>
              <span className="font-mono">{r.value}</span>
            </div>
          ))}
          {footer && (
            <p
              className={cn(
                'flex items-start gap-2 border-t pt-2 text-sm',
                footer.tone === 'warn' ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              {footer.tone === 'warn' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{footer.text}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
