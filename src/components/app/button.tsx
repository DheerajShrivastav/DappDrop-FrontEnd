import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

/**
 * Buttons (app-design §1.11). Pills; labels are verbs ("Propose the list", "Record the end").
 *
 * - `primary`: the ink pill. The one main action per screen (Connect, Propose the list, Continue).
 * - `reward`: the gold pill. ONLY for claiming a reward (gas-free claim, or the wallet claim
 *   when it's the only way). Gold is the reward colour; never use it for anything else.
 * - `secondary`: the outline pill (rule-strong border). Second actions, and destructive TRIGGERS
 *   ("Cancel campaign"), which always open a <ConfirmDialog/> naming the consequence.
 * - `ghost`: no border; quiet inline actions ("Try gas-free again", "Clear filters").
 * - `danger`: the red outline. ONLY the confirm button inside a destructive confirm dialog. The
 *   red means "this fails or can't be undone"; it is never a call to action.
 *
 * Disabled is a dashed outline with ink-3 text, and ALWAYS comes with its reason: pass
 * `disabledReason` and it's rendered next to the button (and linked with aria-describedby).
 */
export type ButtonVariant = 'primary' | 'reward' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

const BASE =
  'inline-flex max-w-full shrink-0 items-center justify-center gap-2 rounded-full border text-center font-medium leading-tight no-underline sm:whitespace-nowrap transition-colors [transition-duration:var(--dur-micro)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-not-allowed disabled:active:translate-y-0 aria-disabled:cursor-not-allowed'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-ink text-paper can-hover:hover:bg-ink-2',
  reward: 'border-transparent bg-signal font-semibold text-on-signal can-hover:hover:brightness-110',
  secondary: 'border-rule-strong bg-transparent text-ink can-hover:hover:border-ink',
  ghost: 'border-transparent bg-transparent text-ink underline decoration-rule-strong underline-offset-4 can-hover:hover:decoration-signal',
  danger: 'border-danger bg-transparent text-danger can-hover:hover:bg-sunk',
}

const DISABLED = 'disabled:border-dashed disabled:border-rule-strong disabled:bg-transparent disabled:text-ink-3 disabled:font-medium disabled:brightness-100'

const SIZES: Record<ButtonSize, string> = {
  // min-height, so a long label can wrap to two lines on a 320 px phone instead of overflowing.
  md: 'min-h-12 px-6 py-2 text-body',
  sm: 'min-h-11 px-[1.1rem] py-2 text-small',
}

export function buttonClass({ variant = 'primary', size = 'md', block = false, className }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cn(BASE, VARIANTS[variant], DISABLED, SIZES[size], block && 'w-full', className)
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  /** Render the child (a <Link>, an <a>) with the button's look. */
  asChild?: boolean
  /** Shows a spinner, sets aria-busy and disables the button. Keep the label a verb in progress ("Sending…"). */
  loading?: boolean
  /** Why the button is disabled, in words. Rendered next to it; required by the design whenever it's disabled. */
  disabledReason?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, asChild, loading, disabled, disabledReason, className, children, type, ...props },
  ref,
) {
  const reasonId = React.useId()
  const isDisabled = disabled || loading
  const showReason = isDisabled && !loading && disabledReason
  const cls = buttonClass({ variant, size, block, className })

  const button = asChild ? (
    <Slot ref={ref} className={cls} {...props}>
      {children}
    </Slot>
  ) : (
    <button
      {...props}
      ref={ref}
      type={type ?? 'button'}
      className={cls}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-describedby={showReason ? reasonId : props['aria-describedby']}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )

  if (!showReason) return button
  return (
    <span className={cn('inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1.5', block && 'flex w-full')}>
      {button}
      <span id={reasonId} className="text-[0.8125rem] leading-snug text-ink-2">
        {disabledReason}
      </span>
    </span>
  )
})

/** A 14 px ring spinner (static under reduced motion: the global safety net stops it). */
export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />
}
