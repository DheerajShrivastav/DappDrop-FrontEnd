'use client'

import { useEffect, useState } from 'react'
import { track } from '@/lib/track'
import { THEME_COLOR, THEME_EVENT, THEME_STORAGE_KEY, type Theme } from './theme'

/**
 * 07-wow: the header's sun/moon toggle (≈0.6 KB). A real <button> with a stable name ("Light
 * theme") and aria-pressed (pressed = Porcelain). The icon is picked by CSS from <html
 * data-theme>, so it's right before hydration too. On click: set data-theme, remember it
 * (try/catch), dispatch the contract's event for the 3D scene, crossfade the page colours.
 */
export function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    const sync = () => {
      const t = (document.documentElement.dataset.theme === 'porcelain' ? 'porcelain' : 'obsidian') as Theme
      setLight(t === 'porcelain')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
    }
    sync()
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  const toggle = () => {
    const theme: Theme = light ? 'obsidian' : 'porcelain'
    const html = document.documentElement
    html.classList.add('lp-theme-swap')
    html.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }))
    track('theme_change', { theme })
    window.setTimeout(() => html.classList.remove('lp-theme-swap'), 450)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={light}
      aria-label="Light theme"
      title={light ? 'Switch to the dark theme' : 'Switch to the light theme'}
      className="lp-tt inline-flex h-11 w-11 shrink-0 max-[359px]:h-10 max-[359px]:w-10 items-center justify-center rounded-full border border-rule-strong text-ink can-hover:hover:border-ink"
      data-theme-toggle
    >
      <svg className="lp-tt-sun" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="10" cy="10" r="3.6" />
        <path d="M10 1.8v2.1M10 16.1v2.1M1.8 10h2.1M16.1 10h2.1M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5" />
      </svg>
      <svg className="lp-tt-moon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" />
      </svg>
    </button>
  )
}
