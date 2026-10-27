import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Stat = {
  label: ReactNode
  /** The figure. `null` = couldn't load: shows "—" with the title "Couldn't load". */
  value: ReactNode | null
  /** A short line under the figure ("2 ending this week"). */
  note?: ReactNode
}

/**
 * The stat row (dashboard: Campaigns · Open now · Participants · Gas-free claims): serif figures
 * between hairlines, mono labels. 4 across on desktop, 2 on phones. Never an invented number:
 * pass `null` when it couldn't load.
 */
export function StatRow({ stats, className, label = 'Summary' }: { stats: Stat[]; className?: string; label?: string }) {
  return (
    <dl aria-label={label} className={cn('grid grid-cols-2 border-y border-rule md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]', className)} style={{ ['--n' as string]: stats.length }}>
      {stats.map((s, i) => (
        <div
          key={i}
          className={cn(
            'flex flex-col gap-3 border-rule px-1 py-5 md:px-0',
            i % 2 === 1 && 'max-md:border-l max-md:pl-5',
            i >= 2 && 'max-md:border-t',
            i > 0 && 'md:border-l md:pl-6',
          )}
        >
          <dt className="dd-eyebrow">{s.label}</dt>
          <dd className="m-0">
            {s.value === null ? (
              <span className="dd-display text-[2.75rem] leading-none text-ink-3" title="Couldn’t load">
                —<span className="sr-only">Couldn’t load</span>
              </span>
            ) : (
              <span className="dd-display text-[2.75rem] leading-none text-ink [font-feature-settings:'tnum']">{s.value}</span>
            )}
            {s.note && <span className="mt-2 block text-[0.8125rem] text-ink-2">{s.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
