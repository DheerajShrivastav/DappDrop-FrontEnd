'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Form fields (app-design §1.10). A 600-weight label, an optional "(optional)", help text under
 * the label, a 48 px control on --sunk with a --rule-strong border and a 2 px gold focus ring.
 * Errors are in the one red: a red border with a 3 px inset bar, and "! Enter an amount above 0."
 * underneath, wired with aria-invalid + aria-describedby.
 */

const CONTROL =
  'w-full rounded-md border border-rule-strong bg-sunk px-[0.9rem] text-[0.9375rem] text-ink placeholder:text-ink-3 transition-colors [transition-duration:var(--dur-micro)] focus-visible:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:text-ink-3 aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[inset_3px_0_0_var(--danger)]'

/** Class string for a 48 px control (use on a shadcn SelectTrigger, a date trigger…). */
export const controlClass = (className?: string) => cn(CONTROL, 'flex h-12 items-center', className)

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(CONTROL, 'h-12', className)} {...props} />
})

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(CONTROL, 'min-h-[7.5rem] py-3 leading-relaxed', className)} {...props} />
})

/** A native <select> in the field style (for short lists; use the shadcn Select for rich items). */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <span className="relative block">
      <select ref={ref} className={cn(CONTROL, 'h-12 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-2 w-2 -translate-y-[70%] rotate-45 border-b-[1.5px] border-r-[1.5px] border-ink-2" />
    </span>
  )
})

/** "! Enter an amount above 0." in the one red. */
export function InlineError({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <p id={id} className={cn('flex items-baseline gap-1.5 text-[0.8125rem] leading-snug text-danger', className)}>
      <span aria-hidden="true" className="font-mono font-semibold">
        !
      </span>
      <span>{children}</span>
    </p>
  )
}

export type FieldControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-required'?: boolean
}

/**
 * A labelled field. Pass the control as a render function (recommended) or a single element;
 * it receives `id`, `aria-describedby` (help + error) and `aria-invalid`.
 *
 *   <Field label="Amount" help="Per wallet." error={errors.amount}>
 *     {(p) => <Input {...p} inputMode="decimal" />}
 *   </Field>
 */
export function Field({
  label,
  optional,
  required,
  help,
  error,
  count,
  id: idProp,
  className,
  children,
}: {
  label: React.ReactNode
  optional?: boolean
  required?: boolean
  help?: React.ReactNode
  error?: React.ReactNode
  /** A live count under the control (see <CharCount/>). */
  count?: React.ReactNode
  id?: string
  className?: string
  children: React.ReactElement | ((props: FieldControlProps) => React.ReactNode)
}) {
  const auto = React.useId()
  const id = idProp ?? `f${auto.replace(/:/g, '')}`
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined
  const controlProps: FieldControlProps = { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined }
  const control = typeof children === 'function' ? children(controlProps) : React.cloneElement(children, controlProps)

  return (
    <div className={cn('grid content-start gap-[0.45rem]', className)} data-field-error={error ? '' : undefined}>
      <label htmlFor={id} className="text-[0.9375rem] font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-3">(optional)</span>}
      </label>
      {help && (
        <p id={helpId} className="-mt-0.5 text-[0.8125rem] leading-snug text-ink-2">
          {help}
        </p>
      )}
      {control}
      {(error || count) && (
        <div className="flex items-baseline justify-between gap-3">
          {error ? <InlineError id={errorId}>{error}</InlineError> : <span />}
          {count}
        </div>
      )}
    </div>
  )
}

/**
 * Live character count in mono ink-3: "12/50 min" while under the minimum, then "62 characters"
 * (or "62/200" against a maximum). Announced politely.
 */
export function CharCount({ value, min, max }: { value: string; min?: number; max?: number }) {
  const n = value.length
  const text = min !== undefined && n < min ? `${n}/${min} min` : max !== undefined ? `${n}/${max}` : `${n} ${n === 1 ? 'character' : 'characters'}`
  return (
    <span className="shrink-0 font-mono text-[0.75rem] text-ink-3" aria-live="polite">
      {text}
    </span>
  )
}

/**
 * A locked field (the payment network): a dashed border, "Locked", and the reason underneath.
 */
export function LockedField({ label, value, reason }: { label: React.ReactNode; value: React.ReactNode; reason: React.ReactNode }) {
  const id = React.useId()
  return (
    <div className="grid content-start gap-[0.45rem]">
      <span id={`${id}-l`} className="text-[0.9375rem] font-semibold text-ink">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${id}-l`}
        aria-describedby={`${id}-r`}
        className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-dashed border-rule-strong px-[0.9rem] text-[0.9375rem] text-ink-2"
      >
        <span className="min-w-0 [overflow-wrap:anywhere]">{value}</span>
        <span className="shrink-0 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-ink-3">Locked</span>
      </div>
      <p id={`${id}-r`} className="text-[0.8125rem] leading-snug text-ink-2">
        {reason}
      </p>
    </div>
  )
}

/**
 * The error summary shown on Continue when 2 or more fields are wrong: "2 things to fix", with
 * links that move focus to each field. It takes focus itself when it appears (pass `focusOnMount`).
 */
export const ErrorSummary = React.forwardRef<HTMLDivElement, { errors: { id: string; message: string }[]; focusOnMount?: boolean }>(function ErrorSummary(
  { errors, focusOnMount = true },
  ref,
) {
  const inner = React.useRef<HTMLDivElement>(null)
  const titleId = `es${React.useId().replace(/:/g, '')}`
  React.useImperativeHandle(ref, () => inner.current as HTMLDivElement)
  React.useEffect(() => {
    if (focusOnMount && errors.length > 1) inner.current?.focus()
  }, [focusOnMount, errors.length])
  if (errors.length < 2) return null
  return (
    <div ref={inner} tabIndex={-1} role="alert" aria-labelledby={titleId} className="rounded-lg border border-danger bg-surface p-5 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
      <p id={titleId} className="flex items-baseline gap-2 font-semibold text-ink">
        <span aria-hidden="true" className="font-mono text-danger">
          !
        </span>
        {errors.length} things to fix
      </p>
      <ul className="mt-2 grid gap-1 pl-5">
        {errors.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              onClick={(ev) => {
                ev.preventDefault()
                document.getElementById(e.id)?.focus()
              }}
              className="text-small text-danger underline underline-offset-4"
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
})

/**
 * A segmented choice (the schedule's "As soon as it's created | Schedule for later", the
 * duration presets, the /campaigns status filter). Native radios, so arrow keys and forms work.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  name,
  hideLabel = false,
  className,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: React.ReactNode }[]
  name?: string
  hideLabel?: boolean
  className?: string
}) {
  const auto = React.useId()
  const group = name ?? `seg${auto.replace(/:/g, '')}`
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className={hideLabel ? 'sr-only' : 'mb-2 text-[0.9375rem] font-semibold text-ink'}>{label}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-[2px] rounded-[1.5rem] border border-rule-strong p-[3px]">
        {options.map((o) => {
          const on = o.value === value
          return (
            <label
              key={o.value}
              className={cn(
                'relative inline-flex h-[2.375rem] cursor-pointer items-center whitespace-nowrap rounded-full px-4 text-small transition-colors [transition-duration:var(--dur-micro)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-signal',
                on ? 'bg-ink text-paper' : 'text-ink-2 can-hover:hover:text-ink',
              )}
            >
              <input type="radio" name={group} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {o.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
