import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Loading, empty and error patterns (app-design §1.12).
 * - Loading: hairline skeletons in the EXACT final shape (no full-page spinners). A quiet pulse,
 *   none under reduced motion. Wrap a group in <LoadingRegion label="Loading campaigns">.
 * - Empty: one serif line + one plain line + one action.
 * - Error: the same shape with "!" in the one red and the reason in plain words, plus a retry.
 *   Never silent, never a fallback to invented data.
 */

/** A hairline block. Size it with classes (h-6 w-40, aspect-[16/7]…). Decorative. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('dd-skel', className)} />
}

/** Announces "Loading…" once for a group of skeletons and marks it busy. */
export function LoadingRegion({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/** The campaign card skeleton: the card's exact shape (chip, 2-line title, host, 3 fact rows, footer). */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-3 rounded-[10px] border border-rule bg-surface p-5', className)}>
      <div className="flex gap-2">
        <Skeleton className="h-[1.625rem] w-20 rounded-full" />
        <Skeleton className="h-[1.625rem] w-28 rounded-full" />
      </div>
      <Skeleton className="h-7 w-4/5" />
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-4 w-36" />
      <div className="mt-2 grid gap-3 border-t border-rule pt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex justify-between gap-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-2 h-4 w-2/3" />
    </div>
  )
}

/** Rows (task rows, table rows): `count` hairline rows of a number, a line and a right-hand state. */
export function RowsSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('border-t border-rule', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-rule py-[1.1rem]">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  )
}

/** The claim panel while checking: an amount bar and two button shapes. */
export function ClaimSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('rounded-[10px] border border-rule-strong bg-surface p-5 md:p-7', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-14 w-40" />
      <Skeleton className="mt-4 h-4 w-3/4" />
      <div className="mt-6 flex flex-wrap gap-3">
        <Skeleton className="h-12 w-56 rounded-full" />
        <Skeleton className="h-12 w-44 rounded-full" />
      </div>
    </div>
  )
}

/**
 * Empty: "No campaigns yet." (serif) + "Your first one takes about 5 minutes." + [New campaign].
 */
export function EmptyState({ title, body, action, className, headingLevel = 'h2' }: { title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string; headingLevel?: 'h2' | 'h3' | 'p' }) {
  const H = headingLevel
  return (
    <div className={cn('grid justify-items-start gap-3 border-y border-rule py-10', className)}>
      <H className="dd-display text-[1.75rem] leading-[1.15] text-ink">{title}</H>
      {body && <p className="max-w-[52ch] text-body text-ink-2">{body}</p>}
      {action && <div className="mt-2 flex flex-wrap gap-3">{action}</div>}
    </div>
  )
}

/**
 * Error: "! We couldn't load campaigns." + "The indexer didn't answer." + [Try again].
 * `live` announces it (role="alert") when it replaces content after a load.
 */
export function ErrorState({
  title,
  reason,
  action,
  live = true,
  className,
  headingLevel = 'h2',
}: {
  title: ReactNode
  reason?: ReactNode
  action?: ReactNode
  live?: boolean
  className?: string
  headingLevel?: 'h2' | 'h3' | 'p'
}) {
  const H = headingLevel
  return (
    <div role={live ? 'alert' : undefined} className={cn('grid justify-items-start gap-3 border-y border-rule py-10', className)} data-error-state>
      <H className="dd-display flex items-baseline gap-3 text-[1.75rem] leading-[1.15] text-ink">
        <span aria-hidden="true" className="font-mono text-[1.25rem] font-semibold text-danger">
          !
        </span>
        <span>{title}</span>
      </H>
      {reason && <p className="max-w-[52ch] text-body text-ink-2">{reason}</p>}
      {action && <div className="mt-2 flex flex-wrap gap-3">{action}</div>}
    </div>
  )
}
