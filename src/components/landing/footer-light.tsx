'use client'

import { useEffect } from 'react'

/**
 * The footer wordmark's cursor light (< 1 KB). Fine pointers only, never under reduced motion,
 * and the pointermove listener (passive, rAF-throttled) exists only while the wordmark is in view.
 * It just moves two CSS variables (--mx, --my) that position a radial light in the fill.
 */
export function FooterLight() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-ft-mark]')
    if (!el || !matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return
    let raf = 0
    let x = 0
    let y = 0
    const paint = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${x - r.left}px`)
      el.style.setProperty('--my', `${y - r.top}px`)
    }
    const move = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(paint)
    }
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) addEventListener('pointermove', move, { passive: true })
      else removeEventListener('pointermove', move)
    })
    io.observe(el)
    return () => {
      io.disconnect()
      removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [])
  return null
}
