'use client'

import { useEffect } from 'react'

/**
 * 07-wow (≈0.3 KB): two bits of header state, no re-render.
 * - aria-current="page" on the nav link for the current path (the header lives in a layout,
 *   which can't know the path on the server; the marketing pages are full page loads).
 * - data-top on the header while the page is at the very top (transparent over the stage);
 *   without JS the header stays solid.
 */
export function HeaderState() {
  useEffect(() => {
    const path = location.pathname.replace(/\/$/, '') || '/'
    document.querySelectorAll<HTMLAnchorElement>('a[data-nav]').forEach((a) => {
      if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page')
    })
    const header = document.querySelector<HTMLElement>('.lp-header')
    if (!header) return
    const onScroll = () => header.toggleAttribute('data-top', scrollY < 8)
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [])
  return null
}
