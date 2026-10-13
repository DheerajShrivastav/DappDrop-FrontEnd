'use client'

import { useRouter } from 'next/navigation'
import { useRef, type MouseEvent } from 'react'

/**
 * S1-14 / CD ruling (CR-28, D19 default): app CTAs prefetch their route only on intent
 * (pointerenter, focus, touchstart): 0 idle bytes on phone data. A plain click then navigates
 * client-side, so the prefetch isn't wasted; modified clicks open normally. 07-wow: every
 * "Start a campaign" CTA uses it (they go straight to /create-campaign).
 */
export function IntentPrefetch({
  href,
  className,
  children,
  cta,
  loc,
  id,
}: {
  href: string
  className: string
  children: React.ReactNode
  /** cta_id for analytics (src/lib/track.ts, IA §5.1). */
  cta: string
  loc: string
  id?: string
}) {
  const router = useRouter()
  const done = useRef(false)
  const prefetch = () => {
    if (done.current) return
    done.current = true
    router.prefetch(href)
  }
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    router.push(href)
  }
  return (
    <a id={id} href={href} className={className} onPointerEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch} onClick={onClick} data-cta={cta} data-loc={loc}>
      {children}
    </a>
  )
}
