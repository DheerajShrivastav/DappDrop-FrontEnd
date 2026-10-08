'use client'

import { useEffect, useRef, useState } from 'react'
import { track } from '@/lib/track'

/**
 * S1-06: the slip's highlight trace (plan §2.1 "Motion"; MOT SM-1 as corrected).
 *
 * - The rest state is the completed, server-rendered slip; this only highlights it.
 * - Starts once, after #slip has been ≥ 50% visible for 500 ms. WAAPI, transform/opacity only.
 * - Beats (Stage 2, 5 beats, 5.0 s): total stamps 0.8 → task ticks 1.0 (the self-reported chip
 *   stays still) → 24 h sweep 1.6 → wallet chips fill 0.9 → reclaim glows once 0.7.
 *   Stage 1 (stage=4) drops the task-tick beat: 4.0 s.
 * - No `fill: forwards`: finished animations drop out of getAnimations(), so nothing runs after
 *   the trace and nothing is left hidden. No rAF, no storage, no timers once it's done.
 * - "Pause animation" (aria-pressed, the first control) and "Replay" (build from empty), 44 px.
 * - Reduced motion: no autoplay; Replay completes instantly (the slip is already complete).
 */
type Beat = [selector: string, frames: Keyframe[], duration: number, stagger: number, easing?: string]

// --ease-lock (MOT): a spring with ~1.5% overshoot. WAAPI can't read CSS variables, so it's
// inlined; browsers without linear() easing fall back to a plain curve.
const LOCK =
  'linear(0,.057,.188,.344,.498,.635,.749,.837,.903,.949,.98,.999,1.009,1.014,1.015,1.014,1.012,1.01,1.008,1.005,1.004,1.002,1.001,1.001,1)'
const BEATS: Beat[] = [
  ['[data-b="total"]', [{ transform: 'scale(1)' }, { transform: 'scale(.98)' }, { transform: 'scale(1)' }], 800, 0, LOCK],
  ['[data-b="tick"]', [{ opacity: 0.35, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], 400, 120],
  ['.slip-sweep', [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 1600, 0, 'cubic-bezier(.65,0,.35,1)'],
  ['[data-b="wallet"]', [{ opacity: 0.25 }, { opacity: 1 }], 450, 150],
  ['.slip-glow', [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], 700, 0],
]
// Beat lengths on the timeline (ms): 0.8 / 1.0 / 1.6 / 0.9 / 0.7.
const SPANS = [800, 1000, 1600, 900, 700]

export function SlipTrace({ stage }: { stage: 4 | 5 }) {
  const [paused, setPaused] = useState(false)
  const anims = useRef<Animation[]>([])
  const pausedRef = useRef(false)

  const run = () => {
    const slip = document.getElementById('slip')
    if (!slip) return
    anims.current.forEach((a) => a.cancel())
    anims.current = []
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let t = 0
    BEATS.forEach(([sel, frames, dur, stagger, easing], i) => {
      if (stage === 4 && i === 1) return // Stage 1: no task-tick beat
      slip.querySelectorAll<HTMLElement>(sel).forEach((el, j) => {
        const opts: KeyframeAnimationOptions = {
          duration: reduce ? 0 : dur,
          delay: reduce ? 0 : t + j * stagger,
          easing: easing ?? 'ease-out',
          fill: 'backwards',
        }
        let a: Animation
        try {
          a = el.animate(frames, opts)
        } catch {
          a = el.animate(frames, { ...opts, easing: 'cubic-bezier(.3,0,.2,1)' })
        }
        anims.current.push(a)
      })
      t += SPANS[i]
    })
    if (pausedRef.current) anims.current.forEach((a) => a.pause())
    const last = anims.current[anims.current.length - 1]
    last?.finished.then(() => track('slip_trace_complete'), () => {})
  }

  useEffect(() => {
    const slip = document.getElementById('slip')
    if (!slip || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer: number | undefined
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          timer = window.setTimeout(() => {
            io.disconnect()
            if (!pausedRef.current) run()
          }, 500)
        } else window.clearTimeout(timer)
      },
      { threshold: 0.5 },
    )
    io.observe(slip)
    return () => {
      io.disconnect()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const togglePause = () => {
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    anims.current.forEach((a) => (next ? a.pause() : a.playState === 'paused' && a.play()))
    if (next) track('motion_paused')
  }

  const replay = () => {
    run()
    track('slip_replay')
  }

  const btn =
    'inline-flex h-11 w-11 items-center justify-center rounded-sm border border-rule-strong bg-surface text-ink can-hover:hover:border-ink aria-pressed:border-ink aria-pressed:bg-sunk'

  return (
    <div className="absolute right-4 top-4 flex gap-2 sm:right-6 sm:top-5">
      <button type="button" className={btn} aria-pressed={paused} aria-label="Pause animation" onClick={togglePause}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <rect x="3" y="2" width="3.5" height="12" rx="1" />
          <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
        </svg>
      </button>
      <button type="button" className={btn} aria-label="Replay animation" onClick={replay}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
          <path d="M2.5 2.5v3.5H6" />
        </svg>
      </button>
    </div>
  )
}
