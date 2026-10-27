import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type KeyValueItem = {
  label: ReactNode
  value: ReactNode
  /** The full value (an untruncated address, an exact time) as a tooltip. */
  title?: string
}

/**
 * The key-value list (the "The campaign" rail, the wizard's "Your campaign so far", Review): a
 * <dl> of hairline rows, labels in ink-2, values in mono on the right. Put it in a <Panel
 * eyebrow="The campaign"> for the rail look.
 */
export function KeyValueList({ items, className }: { items: KeyValueItem[]; className?: string }) {
  return (
    <dl className={cn('dd-kv', className)}>
      {items.map((it, i) => (
        <div key={i}>
          <dt>{it.label}</dt>
          <dd title={it.title}>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}
