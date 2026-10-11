'use client'

import { useRouter } from 'next/navigation'
import { useRef, type MouseEvent } from 'react'

/**
 * S1-14 / CD ruling (CR-28, D19 default): "Continue to the app" prefetches /create-campaign only
 * on intent (pointerenter, focus, touchstart): 0 idle bytes on phone data. A plain click then
 * navigates client-side, so the prefetch isn't wasted; modified clicks open normally.
 */
export function IntentPrefetch({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
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
    <a href={href} className={className} onPointerEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch} onClick={onClick} data-cta="continue_to_app" data-loc="start">
      {children}
    </a>
  )
}
