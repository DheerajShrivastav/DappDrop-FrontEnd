'use client'

import { useId, useState } from 'react'
import { buttonClass, shortAddress } from '@/components/app'
import { cn } from '@/lib/utils'

/**
 * Small pieces shared by the wizard's steps (08-site phase 2, Monolith). Tokens only; the one red
 * is for errors (`Notice tone="error"`), gold `!` marks something that needs attention.
 */

/** A one-line note, an attention note (gold `!`) or an error (red `!`). `title` is optional. */
export function Notice({
  tone = 'note',
  title,
  children,
  className,
  live,
}: {
  tone?: 'note' | 'attention' | 'error'
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
  /** Announce it when it appears (role="status", or "alert" for an error). */
  live?: boolean
}) {
  return (
    <div
      role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-[0.875rem] leading-relaxed',
        tone === 'note' && 'border-dashed border-rule-strong text-ink-2',
        tone === 'attention' && 'border-rule-strong bg-surface text-ink-2',
        tone === 'error' && 'border-danger bg-surface text-ink-2',
        className,
      )}
    >
      {tone !== 'note' && (
        <span aria-hidden="true" className={cn('font-mono font-semibold leading-relaxed', tone === 'error' ? 'text-danger' : 'text-signal')}>
          !
        </span>
      )}
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        {title && <p className={cn('font-semibold', tone === 'error' ? 'text-danger' : 'text-ink')}>{title}</p>}
        {children}
      </div>
    </div>
  )
}

/**
 * An on/off option: a native checkbox row (44 px target), the label and an optional line under
 * it. Replaces the old icon "toggle cards" and the Radix checkbox.
 */
export function CheckRow({
  checked,
  onCheckedChange,
  label,
  description,
  id,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: React.ReactNode
  description?: React.ReactNode
  id?: string
  className?: string
}) {
  const auto = useId()
  const inputId = id ?? `c${auto.replace(/:/g, '')}`
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        aria-describedby={description ? `${inputId}-d` : undefined}
        className="mt-3 h-5 w-5 shrink-0 cursor-pointer accent-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      />
      <div className="min-w-0">
        <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-center text-[0.9375rem] text-ink">
          {label}
        </label>
        {description && (
          <p id={`${inputId}-d`} className="-mt-1.5 text-[0.8125rem] leading-snug text-ink-2">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Collapsible "do this outside DappDrop first" instructions: numbered steps, an optional action
 * link and footnotes. Open by default: the host needs it the first time.
 */
export function SetupChecklist({
  title,
  steps,
  action,
  missingActionText,
  notes,
}: {
  title: string
  steps: React.ReactNode[]
  action?: { label: string; href: string }
  /** Shown in place of the action when it isn't configured. */
  missingActionText?: string
  notes?: React.ReactNode[]
}) {
  const [open, setOpen] = useState(true)
  const id = `sc${useId().replace(/:/g, '')}`
  return (
    <div className="rounded-md border border-rule-strong">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-11 w-full items-center gap-3 rounded-md px-4 py-2 text-left text-[0.9375rem] font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
      >
        <span className="flex-1">{title}</span>
        <span aria-hidden="true" className="font-mono text-[0.75rem] text-ink-3">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && (
        <div id={id} className="grid gap-4 border-t border-rule px-4 py-4">
          <ol className="grid gap-2.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[0.875rem] leading-relaxed text-ink-2">
                <span className="w-5 shrink-0 font-mono text-[0.75rem] leading-[1.6rem] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {action ? (
            <a href={action.href} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'secondary', size: 'sm', className: 'justify-self-start' })}>
              {action.label} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            missingActionText && <Notice tone="error">{missingActionText}</Notice>
          )}
          {notes && notes.length > 0 && (
            <div className="grid gap-1 text-[0.8125rem] text-ink-3">
              {notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** One block of the Review statement: a mono label, an [Edit] link back to its step, the rows. */
export function ReviewSection({ title, onEdit, editLabel, children }: { title: string; onEdit?: () => void; editLabel?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-rule py-5 first:border-t-0 first:pt-0">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 className="dd-eyebrow">{title}</h2>
        {onEdit && (
          <button type="button" onClick={onEdit} className="dd-link inline-flex min-h-11 items-center text-small text-ink" aria-label={editLabel ?? `Edit: ${title}`}>
            Edit
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

/** A shortened 0x address with a copy button; the full address is in the title. */
export function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  if (!address) return <span className="text-ink-3">—</span>
  return (
    <span className="inline-flex items-center gap-1 font-mono" title={address}>
      {shortAddress(address)}
      <button
        type="button"
        aria-label={copied ? 'Address copied' : 'Copy address'}
        className="inline-flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-[0.75rem] text-ink-2 underline decoration-rule-strong underline-offset-4 can-hover:hover:text-ink"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            // Clipboard can be unavailable (insecure context); the address is still in the title.
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}
