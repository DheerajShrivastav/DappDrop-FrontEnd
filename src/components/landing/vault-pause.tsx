'use client'

import { useState } from 'react'
import { track } from '@/lib/track'

declare global {
  interface Window {
    __vault?: { setPaused?: (paused: boolean) => void; ready?: boolean; fallback?: string }
  }
}

/**
 * The 3D's motion toggle (copy §4.2; WCAG 2.2.2), in the hero's CTA row after the CTA and link.
 * 44 px, aria-pressed. CSS shows it only under html.vault-live (never for the poster fallback or
 * reduced motion, where nothing moves). Drives window.__vault.setPaused (3d-requests #4).
 */
export function VaultPause() {
  const [paused, setPaused] = useState(false)
  const toggle = () => {
    const next = !paused
    setPaused(next)
    window.__vault?.setPaused?.(next)
    track('motion_paused', { paused: next, where: 'vault' })
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="mh-pause h-11 w-11 place-items-center rounded-full border border-rule-strong text-ink-2 can-hover:hover:text-ink"
      aria-pressed={paused}
      aria-label="Pause animation"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
        <path className="i-pause" d="M4 3h3v10H4zM9 3h3v10H9z" />
        <path className="i-play" d="M5 3l8 5-8 5z" />
      </svg>
    </button>
  )
}
