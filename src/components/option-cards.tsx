'use client'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

export type OptionCard<V extends string> = {
  value: V
  title: string
  description?: string
  /** Short "best for" line, shown muted under the description. */
  hint?: string
  disabled?: boolean
}

/**
 * A single-choice list rendered as bordered cards — the same pattern as the Schedule field's
 * start choice. Each card is one <label>, so the whole card is the click target.
 */
export function OptionCards<V extends string>({
  value,
  onChange,
  options,
  columns = 1,
  ariaLabel,
}: {
  value: V
  onChange: (v: V) => void
  options: OptionCard<V>[]
  /** 2 or 3 lays cards side by side from the sm breakpoint up; always one column on phones. */
  columns?: 1 | 2 | 3
  ariaLabel?: string
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as V)}
      aria-label={ariaLabel}
      className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex items-start gap-3 rounded-md border p-3 transition-colors',
            o.disabled
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer hover:border-foreground/30 has-[:checked]:border-foreground/40 has-[:checked]:bg-secondary/40',
          )}
        >
          <RadioGroupItem value={o.value} disabled={o.disabled} className="mt-0.5" />
          <span className="min-w-0 space-y-0.5">
            <span className="block text-sm font-medium">{o.title}</span>
            {o.description && <span className="block text-sm text-muted-foreground">{o.description}</span>}
            {o.hint && <span className="block text-xs text-muted-foreground/80">{o.hint}</span>}
          </span>
        </label>
      ))}
    </RadioGroup>
  )
}
