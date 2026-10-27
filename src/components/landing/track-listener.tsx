'use client'

import { useEffect } from 'react'
import { setTrackContext, track } from '@/lib/track'

/**
 * QW-07: one delegated listener for the landing page's events. Rendered only when analytics is
 * on (see the marketing layout), so with no env var it ships nothing.
 *
 * - `cta_click`: any element with data-cta="<cta_id>" (target = its href).
 * - `receipt_jump`: receipts (data-receipt="<rule>").
 * - `proof_item_click`: proof-row chips (data-proof="<chip>").
 * - `outbound_click`: any target=_blank link; destination = data-dest or the link's host.
 * - `section_view`: each [data-section] the first time half of it is visible.
 */
export function TrackListener({ claimsVersion, launchStage }: { claimsVersion: string; launchStage: number }) {
  useEffect(() => {
    setTrackContext({ claims_version: claimsVersion, launch_stage: launchStage })

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('a,button')
      if (!el) return
      const href = el.getAttribute('href') || ''
      const cta = el.getAttribute('data-cta')
      if (cta) track('cta_click', { cta_id: cta, location: el.getAttribute('data-loc') || '', target: href })
      const proof = el.getAttribute('data-proof')
      if (proof) track('proof_item_click', { chip: proof })
      const receipt = el.getAttribute('data-receipt')
      if (receipt) track('receipt_jump', { rule: receipt })
      if (el.getAttribute('target') === '_blank') {
        let dest = el.getAttribute('data-dest') || ''
        if (!dest) {
          try {
            dest = new URL(href, location.href).host
          } catch {}
        }
        track('outbound_click', { destination: dest })
      }
    }
    document.addEventListener('click', onClick)

    const seen = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const id = (en.target as HTMLElement).dataset.section
          if (en.isIntersecting && id && !seen.has(id)) {
            seen.add(id)
            track('section_view', { section: id })
            io.unobserve(en.target)
          }
        }
      },
      { threshold: 0.5 },
    )
    document.querySelectorAll('[data-section]').forEach((s) => io.observe(s))

    return () => {
      document.removeEventListener('click', onClick)
      io.disconnect()
    }
  }, [claimsVersion, launchStage])
  return null
}
