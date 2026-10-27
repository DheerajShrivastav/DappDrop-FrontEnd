'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

export type OptionCard<V extends string> = {
  value: V
  title: string
  description?: string
  /** Short "best for" line, shown under the description. */
  hint?: string
  disabled?: boolean
}

/**
 * A single choice as option cards (app-design §2.5: payout choices, each with one honest line).
 * Native radios, so arrow keys work; the whole card is the click target. Used only by the
 * /create-campaign wizard.
 */
export function OptionCards<V extends string>({
  value,
  onChange,
  options,
  columns = 1,
  ariaLabel,
  id,
}: {
  value: V
  onChange: (v: V) => void
  options: OptionCard<V>[]
  /** 2 or 3 lays cards side by side from the sm breakpoint up; always one column on phones. */
  columns?: 1 | 2 | 3
  ariaLabel?: string
  id?: string
}) {
  const name = `oc${useId().replace(/:/g, '')}`
  return (
    <div role="radiogroup" aria-label={ariaLabel} id={id} className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <label
            key={o.value}
            className={cn(
              'relative flex items-start gap-3 rounded-[10px] border p-4 transition-colors [transition-duration:var(--dur-micro)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal',
              o.disabled ? 'cursor-not-allowed border-dashed border-rule-strong' : 'cursor-pointer',
              !o.disabled && (on ? 'border-ink bg-sunk' : 'border-rule-strong can-hover:hover:border-ink-2'),
            )}
          >
            <input type="radio" name={name} value={o.value} checked={on} disabled={o.disabled} onChange={() => onChange(o.value)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--ink)]" />
            <span className="grid min-w-0 gap-1">
              <span className={cn('text-[0.9375rem] font-semibold', o.disabled ? 'text-ink-2' : 'text-ink')}>{o.title}</span>
              {o.description && <span className="text-[0.875rem] leading-snug text-ink-2">{o.description}</span>}
              {o.hint && <span className="font-mono text-[0.75rem] text-ink-2">{o.hint}</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}
