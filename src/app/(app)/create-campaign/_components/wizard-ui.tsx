'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check, ChevronDown, Copy, ExternalLink, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

/**
 * An on/off option as a bordered card — the whole card is the click target. Same selected
 * style as the Details step's "Verified humans only" card.
 */
export function ToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon
  title: string
  description: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors',
        checked ? 'border-primary bg-primary/5' : 'hover:border-foreground/20 hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
          checked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 space-y-1">
        <span className="block text-sm font-medium leading-none">{title}</span>
        <span className="block text-sm leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
    </label>
  )
}

/**
 * Collapsible "do this outside DappDrop first" instructions: numbered steps, an optional
 * action link, and footnotes. Open by default — the host needs it the first time, and it
 * collapses once they've read it.
 */
export function SetupChecklist({
  icon: Icon,
  title,
  steps,
  action,
  missingActionText,
  notes,
}: {
  icon: LucideIcon
  title: string
  steps: React.ReactNode[]
  action?: { label: string; href: string }
  /** Shown in place of the action when it isn't configured. */
  missingActionText?: string
  notes?: React.ReactNode[]
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium">{title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t px-4 py-4">
          <ol className="space-y-2.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>
          {action ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={action.href} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                {action.label}
              </a>
            </Button>
          ) : (
            missingActionText && (
              <p className="text-sm font-medium text-destructive">{missingActionText}</p>
            )
          )}
          {notes && notes.length > 0 && (
            <div className="space-y-1 text-xs text-muted-foreground">
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

/** One block of the Review step's summary card, with a link back to the step that owns it. */
export function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="mr-1.5 h-3 w-3" />
            Edit
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}

/** A label/value row inside a ReviewSection. */
export function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:justify-between sm:gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 sm:text-right">{children}</span>
    </div>
  )
}

/** A shortened 0x address with a copy button; the full address is in the title tooltip. */
export function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  if (!address) return <span className="text-muted-foreground">—</span>
  const short = address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs" title={address}>
      {short}
      <button
        type="button"
        aria-label="Copy address"
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            // Clipboard can be unavailable (insecure context); the address is still in the tooltip.
          }
        }}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  )
}
