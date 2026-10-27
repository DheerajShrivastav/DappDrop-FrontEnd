/**
 * Founder decision 2026-10-11 (phone height): a block that's collapsible below 768 px only.
 * Server-rendered OPEN, so desktop, tablets and no-JS readers get it expanded; HashDetailsOpener
 * closes it below 768 px on load (unless a deep link points into it). A native <details>/<summary>
 * (keyboard, screen readers and Esc-free), with a chevron shown on phone only.
 */
export function PhoneDetails({
  summary,
  children,
  className = '',
  summaryClassName = '',
  detail,
  onDark = false,
}: {
  summary: React.ReactNode
  children: React.ReactNode
  className?: string
  summaryClassName?: string
  /** detail_open topic for analytics. */
  detail?: string
  /** On the ink band: the chevron uses paper-2 (ink-3 is banned on ink). */
  onDark?: boolean
}) {
  return (
    <details open data-collapse-mobile className={`lp-details ${className}`} data-detail={detail}>
      <summary className={`flex min-h-11 items-center justify-between gap-3 ${summaryClassName}`}>
        <span className="min-w-0 flex-1">{summary}</span>
        <span aria-hidden="true" className={`lp-chevron shrink-0 md:hidden ${onDark ? 'text-paper-2' : 'text-ink-3'}`}>
          ›
        </span>
      </summary>
      {children}
    </details>
  )
}
