import type { ReactNode } from 'react'

/**
 * A landing section (plan §2 rules): an id, a section_view hook (data-section), a mono eyebrow
 * ("01 — …"), a sentence H2 and an optional dek. The H2 takes focus on in-page jumps
 * (tabIndex -1), and scroll-margin keeps it clear of the sticky header.
 */
export function Section({
  id,
  track,
  eyebrow,
  title,
  dek,
  band = 'paper',
  children,
  after,
  className = '',
}: {
  id: string
  track: string
  eyebrow?: string
  title: ReactNode
  dek?: ReactNode
  band?: 'paper' | 'sunk' | 'ink'
  children: ReactNode
  /** Full-bleed content after the container (e.g. the sunk rules band), still inside the section. */
  after?: ReactNode
  className?: string
}) {
  const bg = band === 'sunk' ? 'bg-sunk' : band === 'ink' ? 'lp-ink' : ''
  return (
    <section id={id} aria-labelledby={`${id}-title`} data-section={track} className={`scroll-mt-20 ${bg} ${className}`}>
      <div className={after ? 'lp-container pb-12 pt-[var(--section-y)]' : 'lp-container section-y'}>
        {eyebrow && <p className={`font-mono text-eyebrow font-medium uppercase ${band === 'ink' ? 'text-paper-2' : 'text-ink-3'}`}>{eyebrow}</p>}
        <h2 id={`${id}-title`} tabIndex={-1} className="mt-3 max-w-[24ch] font-display text-display-l font-normal outline-none">
          {title}
        </h2>
        {dek && <p className={`mt-4 max-w-[40rem] text-lead ${band === 'ink' ? 'text-paper-2' : 'text-ink-2'}`}>{dek}</p>}
        {children}
      </div>
      {after}
    </section>
  )
}
