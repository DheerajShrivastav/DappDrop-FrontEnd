import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * The page header (app-design §1.5): eyebrow (mono: "Campaigns · Sepolia testnet") → H1 (serif)
 * → lead (≤ 46 ch, ink-2) → an optional right-aligned action. Campaign pages put a chip row
 * above the H1 (`chips`) and a "← Campaigns" link above that (`back`).
 *
 * One H1 per page: this renders it.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  action,
  chips,
  back,
  meta,
  size = 'lg',
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  /** Right-aligned on desktop, below the lead on phones. One action. */
  action?: ReactNode
  /** Chip row above the H1 (campaign pages). */
  chips?: ReactNode
  /** "← Campaigns": an app route. */
  back?: { href: string; label: string }
  /** A mono meta line under the lead ("Hosted by 0x51e2…07bd · Campaign #12 on Sepolia"). */
  meta?: ReactNode
  /** `lg` (40–64 px) for top-level pages, `md` (34–52 px) for campaign titles and wizard steps. */
  size?: 'lg' | 'md'
  className?: string
}) {
  return (
    <header className={cn('grid gap-4', className)}>
      {back && (
        <Link href={back.href} prefetch={false} className="-mb-1 inline-flex h-11 w-fit items-center gap-1.5 text-small text-ink-2 can-hover:hover:text-ink">
          <span aria-hidden="true">←</span>
          {back.label}
        </Link>
      )}
      {eyebrow && <p className="dd-eyebrow">{eyebrow}</p>}
      {chips && <div className="flex flex-wrap items-center gap-2">{chips}</div>}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="grid min-w-0 max-w-full gap-4">
          <h1 className={cn('dd-display max-w-[18ch] text-ink [overflow-wrap:anywhere]', size === 'lg' ? 'dd-h1' : 'dd-h1-sm')}>{title}</h1>
          {lead && <p className="dd-lead">{lead}</p>}
          {meta && <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[0.8125rem] text-ink-2">{meta}</div>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-3">{action}</div>}
      </div>
    </header>
  )
}

/** A section heading row: serif H2 on the left, a mono note on the right, a hairline under. */
export function SectionHeader({ title, note, id, as: H = 'h2', className }: { title: ReactNode; note?: ReactNode; id?: string; as?: 'h2' | 'h3'; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-[0.9rem]', className)}>
      <H id={id} className="dd-display dd-h2 text-ink">
        {title}
      </H>
      {note && <span className="font-mono text-small text-ink-2">{note}</span>}
    </div>
  )
}

/** The app's page container: the landing's 1,200 px container plus the page padding (56 px top on desktop, 32 px on phones). */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('lp-container pb-16 pt-8 md:pb-24 md:pt-14', className)}>{children}</div>
}
