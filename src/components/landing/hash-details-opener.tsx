'use client'

import { useEffect } from 'react'
import { track } from '@/lib/track'

/**
 * D-X14 (≈0.3 KB): opens a <details> when the URL hash points at it (or at an element that
 * contains one), on load and on hash change: #faq-beta, #can-cant, any #faq-* item. Also opens
 * details[data-open-desktop] at ≥ 1024 px (the can/can't card is open on desktop, closed on
 * phone). Fires detail_open / faq_open when a reader opens one.
 */
export function HashDetailsOpener() {
  useEffect(() => {
    if (matchMedia('(min-width: 1024px)').matches) {
      document.querySelectorAll<HTMLDetailsElement>('details[data-open-desktop]').forEach((d) => (d.open = true))
    }
    const open = () => {
      const id = decodeURIComponent(location.hash.slice(1))
      const el = id ? document.getElementById(id) : null
      const d = el && (el.tagName === 'DETAILS' ? (el as HTMLDetailsElement) : el.querySelector('details'))
      if (d) d.open = true
    }
    open()
    addEventListener('hashchange', open)
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement
      if (!d.open) return
      const faq = d.getAttribute('data-faq')
      if (faq) track('faq_open', { question_id: faq })
      const topic = d.getAttribute('data-detail')
      if (topic) track('detail_open', { topic })
    }
    document.addEventListener('toggle', onToggle, true)
    return () => {
      removeEventListener('hashchange', open)
      document.removeEventListener('toggle', onToggle, true)
    }
  }, [])
  return null
}
