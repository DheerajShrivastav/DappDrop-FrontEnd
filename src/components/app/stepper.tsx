import Link from 'next/link'
import { cn } from '@/lib/utils'

export type WizardStep = {
  /** "Details", "Tasks", "Rewards", "Review". */
  name: string
  /** One line under the name on desktop ("Name, schedule, image"). */
  hint?: string
  /** A done step links back: a URL… */
  href?: string
  /** …or a handler (client wizards). */
  onSelect?: () => void
}

/** "Step 2 of 4": the page eyebrow on phones, where only the current step shows its name. */
export function stepEyebrow(current: number, total: number): string {
  return `Step ${current + 1} of ${total}`
}

/**
 * The wizard stepper (app-design §1.10): one column per step, each with a top hairline.
 * - Done: an ink-2 rule and "01 Details ✓", a link back (href or onSelect).
 * - Current: a 2 px gold rule, the label in gold, the name in ink (aria-current="step").
 * - Upcoming: ink-3, not interactive.
 * On a phone only the current step shows its name ("01 · 02 Tasks · 03 · 04"); the others keep
 * theirs for screen readers.
 *
 * `current` is 0-based. A server component unless you pass `onSelect` from a client parent.
 */
export function WizardStepper({ steps, current, label = 'Steps', className }: { steps: WizardStep[]; current: number; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="dd-stepper" style={{ ['--steps' as string]: steps.length }}>
        {steps.map((s, i) => {
          const state = i < current ? 'is-done' : i === current ? 'is-now' : 'is-later'
          const n = String(i + 1).padStart(2, '0')
          const inner = (
            <>
              <span className="dd-step-k">
                {n} <span className="dd-step-name">{s.name}</span>
                {state === 'is-done' && (
                  <>
                    <span aria-hidden="true" className="text-signal">
                      {' '}
                      ✓
                    </span>
                    <span className="sr-only"> (done)</span>
                  </>
                )}
              </span>
              {s.hint && <span className="dd-step-v">{s.hint}</span>}
            </>
          )
          let body = <div className="min-h-11">{inner}</div>
          if (state === 'is-done' && s.href) {
            body = (
              <Link href={s.href} prefetch={false}>
                {inner}
              </Link>
            )
          } else if (state === 'is-done' && s.onSelect) {
            body = (
              <button type="button" onClick={s.onSelect} className="block min-h-11 w-full text-left">
                {inner}
              </button>
            )
          }
          return (
            <li key={s.name} className={state} aria-current={state === 'is-now' ? 'step' : undefined}>
              {body}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
