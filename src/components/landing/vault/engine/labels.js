// In-scene labels are real DOM (aria-hidden duplicates of text that is also in the sections),
// positioned each frame by projecting a world point. Never the only place information lives.
import { Vector3 } from 'three'

export function createLabels(root) {
  const els = {}
  for (const el of root.querySelectorAll('[data-wow-label]')) els[el.dataset.wowLabel] = { el, o: -1, x: 0, y: 0, w: 0 }
  const v = new Vector3()
  return {
    set(name, pos, opacity, camera, w, h, dx = 12, dy = -12) {
      const L = els[name]
      if (!L) return
      const o = Math.round(opacity * 100) / 100
      if (o <= 0.001) { if (L.o !== 0) { L.el.style.opacity = '0'; L.o = 0 } return }
      v.copy(pos).project(camera)
      if (!L.w) L.w = L.el.offsetWidth || 120
      // keep the pill fully on screen (flip to the left of the point if it would clip)
      let x = ((v.x + 1) / 2) * w + dx
      if (x + L.w > w - 8) x = ((v.x + 1) / 2) * w - L.w - Math.abs(dx)
      x = Math.round(Math.max(8, Math.min(w - L.w - 8, x)))
      const y = Math.round(Math.max(60, Math.min(h - 40, ((1 - v.y) / 2) * h + dy)))
      if (x !== L.x || y !== L.y) { L.el.style.transform = `translate(${x}px, ${y}px)`; L.x = x; L.y = y }
      if (o !== L.o) { L.el.style.opacity = String(o); L.o = o }
    },
    text(name, sel, t) {
      const n = els[name]?.el.querySelector(sel)
      if (n && n.textContent !== t) n.textContent = t
    },
  }
}
