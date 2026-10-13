// Camera rig: keyframes on the story axis T, Catmull-Rom through positions and targets,
// critically damped follow (no stop-and-go at keys), a breathing idle drift, pointer parallax,
// and a lens shift (setViewOffset) so the object can sit right of the copy on desktop
// and above it on phones without moving it in world space.
import { CatmullRomCurve3, Vector3, MathUtils } from 'three'

const { clamp, lerp, smoothstep, degToRad, radToDeg } = MathUtils
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))

export class Pointer {
  constructor() {
    this.x = 0; this.y = 0; this.sx = 0; this.sy = 0; this.vx = 0; this.vy = 0
    this.active = matchMedia('(pointer: fine)').matches
    this.on = (e) => {
      this.x = (e.clientX / innerWidth) * 2 - 1
      this.y = -((e.clientY / innerHeight) * 2 - 1)
    }
    if (this.active) addEventListener('pointermove', this.on, { passive: true })
  }
  update(dt) {
    const px = this.sx, py = this.sy
    this.sx = damp(this.sx, this.x, 4, dt)
    this.sy = damp(this.sy, this.y, 4, dt)
    const k = dt > 0 ? 1 / dt : 0
    this.vx = damp(this.vx, (this.sx - px) * k, 6, dt)
    this.vy = damp(this.vy, (this.sy - py) * k, 6, dt)
  }
  dispose() { removeEventListener('pointermove', this.on) }
}

export class Rig {
  constructor(camera, keys, { parallax = 0.2, portraitFit = 0.75, portraitFov = 1, portraitDolly = 1, lambda = 3.2, breathe = 1 } = {}) {
    this.camera = camera
    this.keys = keys
    this.parallax = parallax
    this.portraitFit = portraitFit
    this.portraitFov = portraitFov
    this.portraitDolly = portraitDolly // phones: pull the camera back rather than widen the lens
    this.lambda = lambda
    this.breathe = breathe
    this.posCurve = new CatmullRomCurve3(keys.map((k) => new Vector3(...k.pos)), false, 'centripetal')
    this.tgtCurve = new CatmullRomCurve3(keys.map((k) => new Vector3(...k.tgt)), false, 'centripetal')
    this.Ts = null
    this.w = 1
    this.h = 1
    this.pos = new Vector3()
    this.tgt = new Vector3()
    this._f = new Vector3()
    this._r = new Vector3()
    this._u = new Vector3()
  }

  resize(w, h) {
    this.w = w
    this.h = h
    this.camera.aspect = w / h
  }

  snap(T) { this.Ts = T }

  // Returns the damped story value every other system should use.
  update(T, dt, time, pointer) {
    if (this.Ts == null) this.Ts = T
    this.Ts = damp(this.Ts, T, this.lambda, dt)
    if (Math.abs(this.Ts - T) < 1e-4) this.Ts = T
    const Ts = this.Ts
    const keys = this.keys
    let i = 0
    while (i < keys.length - 2 && Ts > keys[i + 1].T) i++
    const k0 = keys[i], k1 = keys[i + 1]
    const f = clamp((Ts - k0.T) / (k1.T - k0.T), 0, 1)
    const u = (i + f) / (keys.length - 1)
    this.posCurve.getPoint(u, this.pos)
    this.tgtCurve.getPoint(u, this.tgt)
    const sf = smoothstep(f, 0, 1)
    const portrait = this.w / this.h < 1
    const fov = lerp(k0.fov, k1.fov, sf)
    const s0 = (portrait && k0.shiftP) || k0.shift || [0, 0]
    const s1 = (portrait && k1.shiftP) || k1.shift || [0, 0]
    const sx = lerp(s0[0], s1[0], sf)
    const sy = lerp(s0[1], s1[1], sf)

    if (portrait && this.portraitDolly !== 1) this.pos.sub(this.tgt).multiplyScalar(this.portraitDolly).add(this.tgt)
    const b = this.breathe
    this.pos.x += Math.sin(time * 0.13) * 0.08 * b
    this.pos.y += Math.sin(time * 0.17 + 1.3) * 0.05 * b
    this.tgt.y += Math.sin(time * 0.11 + 0.4) * 0.02 * b

    if (pointer && pointer.active) {
      const fwd = this._f.subVectors(this.tgt, this.pos)
      const dist = fwd.length()
      fwd.normalize()
      const right = this._r.crossVectors(fwd, this.camera.up).normalize()
      const up = this._u.crossVectors(right, fwd)
      const a = this.parallax * dist * 0.08
      this.pos.addScaledVector(right, pointer.sx * a).addScaledVector(up, pointer.sy * a * 0.6)
    }

    const cam = this.camera
    cam.position.copy(this.pos)
    cam.lookAt(this.tgt)
    const aspect = this.w / this.h
    let vfov = aspect < 1 ? fov * this.portraitFov : fov
    if (aspect < this.portraitFit) vfov = radToDeg(2 * Math.atan(Math.tan(degToRad(vfov) / 2) * (this.portraitFit / aspect)))
    cam.fov = vfov
    cam.aspect = aspect
    cam.setViewOffset(this.w, this.h, -sx * this.w, sy * this.h, this.w, this.h)
    cam.updateProjectionMatrix()
    return Ts
  }
}
