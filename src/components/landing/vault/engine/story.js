// Story: page scroll -> one number T in [0, 4], read from the page's beat sections.
//   [data-beat=hero]   0..1  (the hero scrolls away)
//   [data-beat=fund]   1..2  [data-beat=prove] 2..3  [data-beat=claim] 3..4
// Sections with data-beat="after" are ignored (the scene rests at T = 4).
// Lenis smooths the wheel on fine-pointer devices only (touch stays native); anchors keep working.
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const BEATS = ['hero', 'fund', 'prove', 'claim']

export function createStory({ still = null, smooth = true }) {
  const sections = BEATS.map((b) => document.querySelector(`[data-beat="${b}"]`))
  let lenis = null
  const raf = (t) => lenis && lenis.raf(t * 1000)
  if (still == null && smooth && matchMedia('(pointer: fine)').matches) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, smoothWheel: true, anchors: true })
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
  }
  const triggers = sections.map((el, i) =>
    el ? ScrollTrigger.create({ trigger: el, start: 'top top', end: i === 0 ? 'bottom top' : 'bottom bottom' }) : null,
  )
  const T = () => (still != null ? +still : triggers.reduce((s, t) => s + (t ? t.progress : 0), 0))
  const scrollYFor = (v) => {
    const i = Math.min(Math.floor(v), 3)
    const st = triggers[i]
    if (!st) return 0
    return st.start + (st.end - st.start) * Math.min(1, v - i)
  }
  const goto = (v) => {
    const y = scrollYFor(v)
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true })
    else window.scrollTo(0, y)
    ScrollTrigger.update()
  }
  const glide = (v, duration) =>
    new Promise((resolve) => {
      const y = scrollYFor(v)
      if (!lenis) { window.scrollTo({ top: y, behavior: 'smooth' }); return setTimeout(resolve, duration * 1000) }
      lenis.scrollTo(y, { duration, easing: ease, force: true, onComplete: resolve })
    })
  return {
    T,
    goto,
    glide,
    sections: sections.filter(Boolean),
    dispose() {
      gsap.ticker.remove(raf)
      lenis?.destroy()
      triggers.forEach((t) => t?.kill())
    },
  }
}
