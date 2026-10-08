'use client'

import { useEffect, useRef } from 'react'

/**
 * S1-03: the sticky phone bar (D-X12; plan §2.0). Shown below 1024 px once the hero CTA has left
 * the top of the viewport; hidden again once #start is in view or passed (falls back to the
 * footer until #start exists). Enters with translateY over --dur-short (instant under reduced
 * motion via the global safety net). While hidden it's inert and aria-hidden, so it's never a
 * tab stop. Without JS it never appears, so it can never hide content.
 */
export function StickyStartBar({ helper }: { helper: string }) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    const cta = document.getElementById('hero-cta')
    const end = document.getElementById('start') ?? document.querySelector('footer')
    if (!bar || !cta) return
    let pastHero = false
    let atEnd = false
    const update = () => {
      const on = pastHero && !atEnd
      bar.toggleAttribute('data-on', on)
      bar.toggleAttribute('inert', !on)
      bar.setAttribute('aria-hidden', String(!on))
    }
    const heroIo = new IntersectionObserver(([e]) => {
      pastHero = !e.isIntersecting && e.boundingClientRect.top < 0
      update()
    })
    heroIo.observe(cta)
    const endIo = end
      ? new IntersectionObserver(([e]) => {
          atEnd = e.isIntersecting || e.boundingClientRect.top < 0
          update()
        })
      : null
    if (end) endIo?.observe(end)
    return () => {
      heroIo.disconnect()
      endIo?.disconnect()
    }
  }, [])

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      // React 18 doesn't know `inert`; an empty string renders the boolean attribute.
      {...({ inert: '' } as object)}
      className="lp-sticky fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper lg:hidden"
    >
      <div className="lp-container flex h-[var(--sticky-bar-h)] items-center justify-between gap-3">
        <span className="font-mono text-eyebrow uppercase text-ink-3">{helper}</span>
        <a
          href="/#start"
          data-cta="sticky_start"
          data-loc="sticky"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-sm border border-transparent bg-ink px-5 text-body font-semibold leading-none text-paper active:translate-y-px"
        >
          Start a test campaign
        </a>
      </div>
    </div>
  )
}
