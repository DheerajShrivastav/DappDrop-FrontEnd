import type { ElementType, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * A panel: the surface card (app-design: hairlines instead of shadows). `tone`:
 * - `surface` (default): --surface fill, --rule border (the rail, the claim panel);
 * - `strong`: --surface with a --rule-strong border (the claim panel when it's the main thing);
 * - `sunk`: --sunk fill (quiet summaries, the AI starter);
 * - `outline`: no fill, --rule border.
 */
export function Panel({
  as: As = 'div',
  tone = 'surface',
  pad = true,
  eyebrow,
  className,
  children,
  ...rest
}: {
  as?: ElementType
  tone?: 'surface' | 'strong' | 'sunk' | 'outline'
  pad?: boolean
  /** A mono label at the top ("The campaign", "Your reward"). */
  eyebrow?: ReactNode
  className?: string
  children: ReactNode
} & Record<string, unknown>) {
  return (
    <As
      className={cn(
        'rounded-[10px] border',
        tone === 'surface' && 'border-rule bg-surface',
        tone === 'strong' && 'border-rule-strong bg-surface',
        tone === 'sunk' && 'border-rule bg-sunk',
        tone === 'outline' && 'border-rule bg-transparent',
        pad && 'p-5 md:p-6',
        className,
      )}
      {...rest}
    >
      {eyebrow && <p className="dd-eyebrow mb-[0.6rem]">{eyebrow}</p>}
      {children}
    </As>
  )
}

/**
 * The campaign card surface (§1.7): the WHOLE card is one link (a stretched link on the title, so
 * its accessible name is the title alone), the hover is a border-colour change only, and the
 * optional host cover shows as a 16:7 band at the top. No cover → no band (never a placeholder).
 *
 *   <CardLink href={`/campaign/${id}`} title={name} cover={imageUrl ? { src: imageUrl } : undefined}>
 *     …chip row, hosted by, fact rows, footer line…
 *   </CardLink>
 *
 * `children` render below the title; `top` above it (the chip row).
 */
export function CardLink({
  href,
  title,
  cover,
  top,
  children,
  headingLevel = 'h3',
  className,
}: {
  href: string
  title: ReactNode
  cover?: { src: string; alt?: string }
  top?: ReactNode
  children?: ReactNode
  headingLevel?: 'h2' | 'h3'
  className?: string
}) {
  const H = headingLevel
  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[10px] border border-rule bg-surface transition-colors [transition-duration:var(--dur-short)] has-[a:hover]:border-ink-3 has-[a:focus-visible]:border-ink-3',
        className,
      )}
    >
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- host-uploaded covers from several hosts; the band reserves its space (16:7), no layout shift.
        <img src={cover.src} alt={cover.alt ?? ''} loading="lazy" decoding="async" className="aspect-[16/7] w-full border-b border-rule bg-sunk object-cover" />
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {top && <div className="flex flex-wrap items-center gap-2">{top}</div>}
        <H className="dd-display line-clamp-2 text-[1.625rem] leading-[1.1] text-ink [overflow-wrap:anywhere]">
          <Link
            href={href}
            prefetch={false}
            className="outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-signal"
          >
            {title}
          </Link>
        </H>
        {children}
      </div>
    </article>
  )
}
