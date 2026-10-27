'use client'

import { useEffect } from 'react'

/**
 * S1-10: the supporting motion. At ≥ 1024 × 700 the #how replica panel cross-fades (280 ms,
 * opacity/transform, CSS) to the step crossing mid-viewport. Nothing below that size (stacked
 * cards), and instant under reduced motion (global safety net). No rAF; one observer.
 */
export function StepSwap() {
  useEffect(() => {
    const mq = matchMedia('(min-width: 1024px) and (min-height: 700px)')
    let io: IntersectionObserver | null = null
    const start = () => {
      io?.disconnect()
      if (!mq.matches) return
      const slides = Array.from(document.querySelectorAll<HTMLElement>('.lp-how-slide'))
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue
            const n = (e.target as HTMLElement).dataset.step
            slides.forEach((s) => s.classList.toggle('is-active', s.dataset.slide === n))
          }
        },
        { rootMargin: '-50% 0px -50% 0px' },
      )
      document.querySelectorAll('.lp-how-step').forEach((s) => io!.observe(s))
    }
    start()
    mq.addEventListener('change', start)
    return () => {
      io?.disconnect()
      mq.removeEventListener('change', start)
    }
  }, [])
  return null
}
