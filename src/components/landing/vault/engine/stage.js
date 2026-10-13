// Stage: owns the WebGLRenderer, the render loop and every "be a good citizen" rule from the brief.
//  - DPR cap (≤1.5 desktop, ≤1.25 phone)
//  - loop runs only while the story track is on screen AND the tab is visible
//  - FPS watchdog: steps DPR down, then asks the scene to drop effects, then gives up -> poster
//  - stats for the README (draw calls, triangles, programs, compile time, frame times)
import { WebGLRenderer, ACESFilmicToneMapping, SRGBColorSpace } from 'three'

export class Stage {
  constructor(el, { tier = 'high', track = [], onFail, dprCap, toneMapping = ACESFilmicToneMapping, exposure = 1, watchdog = true } = {}) {
    this.el = el
    this.tier = tier
    this.onFail = onFail
    this.frameCbs = []
    this.resizeCbs = []
    this.degradeCbs = []
    this.w = 1
    this.h = 1
    this.time = 0
    this.timeScale = 1 // 0 = paused (pause button): scroll still drives the story
    this.running = false
    this.inView = true
    this.failed = false
    this.frames = []
    this.frameCount = 0
    this.degradeLevel = 0
    this.watchdog = watchdog
    this.wd = { start: 0, samples: [] }

    const renderer = (this.renderer = new WebGLRenderer({
      antialias: false, // MSAA happens on the HDR scene target instead
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
    }))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = toneMapping
    renderer.toneMappingExposure = exposure
    renderer.info.autoReset = false // we sum every pass (transmission, reflection, post) per frame
    renderer.setClearColor(0x000000, 1)
    if (tier !== 'high') renderer.transmissionResolutionScale = 0.5

    this.dprCap = dprCap ?? (tier === 'low' ? 1.25 : 1.5)
    this.dpr = Math.min(window.devicePixelRatio || 1, this.dprCap)

    const canvas = renderer.domElement
    canvas.setAttribute('aria-hidden', 'true')
    canvas.setAttribute('tabindex', '-1')
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    el.appendChild(canvas)
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.fail('context-lost')
    })

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(el)
    // "In view" = the story track crosses the viewport's centre line. Once the track's end scrolls
    // above mid-screen (outro/footer taking over), the loop stops; the last frame stays up, frozen.
    // track: the beat sections (hero..claim). In view while any of them crosses the centre line.
    const seen = new Map()
    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target, e.isIntersecting)
        this.inView = [...seen.values()].some(Boolean)
        this.sync()
      },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    for (const el of track || []) this.io.observe(el)
    this.onVis = () => this.sync()
    document.addEventListener('visibilitychange', this.onVis)
    this.resize()
  }

  onFrame(cb) { this.frameCbs.push(cb) }
  onResize(cb) { this.resizeCbs.push(cb); cb(this.w, this.h, this.dpr) }
  onDegrade(cb) { this.degradeCbs.push(cb) }

  resize() {
    const w = Math.max(1, this.el.clientWidth)
    const h = Math.max(1, this.el.clientHeight)
    this.w = w
    this.h = h
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    for (const cb of this.resizeCbs) cb(w, h, this.dpr)
    if (!this.running && this.lastRender) this.requestRender()
  }

  // Compile every program before the first visible frame. compileAsync uses KHR_parallel_shader_compile,
  // so the main thread is not blocked while the driver compiles/links (the canvas is still at opacity 0).
  // extra: [mesh, material] pairs for full-screen post passes that are not in the scene graph.
  async compile(scene, camera, extra = []) {
    const t0 = performance.now()
    const jobs = [this.renderer.compileAsync(scene, camera)]
    for (const [mesh, mat] of extra) {
      const m = mesh.clone()
      m.material = mat
      jobs.push(this.renderer.compileAsync(m, camera))
    }
    await Promise.all(jobs)
    this.compileMs = performance.now() - t0
    this.programs = this.renderer.info.programs.length
  }

  start() {
    this.started = true
    this.sync()
  }

  sync() {
    const should = this.started && this.inView && !document.hidden && !this.failed && !this.paused
    if (should && !this.running) {
      this.running = true
      this.last = performance.now()
      this.wd = { start: this.frameCount, samples: [] } // never judge fps across a pause
      this.raf = requestAnimationFrame(this.tick)
    } else if (!should && this.running) {
      this.running = false
      cancelAnimationFrame(this.raf)
    }
  }

  tick = (now) => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.tick)
    const raw = now - this.last
    this.last = now
    const dt = Math.min(raw / 1000, 1 / 20)
    this.time += dt * this.timeScale
    this.renderFrame(dt)
    this.frameCount++
    if (this.frameCount > 2) {
      this.frames.push(raw)
      if (this.frames.length > 600) this.frames.shift()
      this.checkWatchdog(raw)
    }
  }

  renderFrame(dt) {
    const t0 = performance.now()
    this.renderer.info.reset()
    for (const cb of this.frameCbs) cb(dt, this.time)
    if (this.renderer.info.render.calls) { // frames skipped by render-on-demand report nothing
      this.lastCalls = this.renderer.info.render.calls
      this.lastTris = this.renderer.info.render.triangles
      this.lastPoints = this.renderer.info.render.points
    }
    const ms = performance.now() - t0
    if (this.firstFrameMs == null) this.firstFrameMs = ms
    else { this.cpu = this.cpu || []; this.cpu.push(ms); if (this.cpu.length > 600) this.cpu.shift() }
    this.lastRender = true
  }

  renderOnce() { this.renderFrame(0) }

  // Pause (WCAG 2.2.2 control): stop the rAF loop entirely. Time freezes; nothing renders until
  // requestRender() (theme change, resize, scroll while paused) or resume.
  setPaused(p) {
    this.paused = !!p
    this.timeScale = this.paused ? 0 : 1
    this.sync()
  }

  // One coalesced frame while the loop is stopped. dt = 1 s lets damped values (camera, story) settle.
  requestRender() {
    if (this.running || this.failed || !this.started || this._req) return
    this._req = requestAnimationFrame(() => {
      this._req = 0
      if (!this.running && !this.failed) { this.renderFrame(1); this.oneOffRenders = (this.oneOffRenders || 0) + 1 }
    })
  }

  checkWatchdog(raw) {
    if (!this.watchdog || this.failed) return
    const wd = this.wd
    if (this.frameCount - wd.start < 30) return // warm-up after start/resume
    wd.samples.push(raw)
    if (wd.samples.length < 90) return
    const sorted = [...wd.samples].sort((a, b) => a - b)
    const median = sorted[sorted.length >> 1]
    wd.start = this.frameCount
    wd.samples = []
    if (median <= 1000 / 28) return
    // Too slow: degrade one step at a time.
    if (this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr * 0.75)
      this.resize()
    } else if (this.degradeLevel < 1) {
      this.degradeLevel++
      for (const cb of this.degradeCbs) cb(this.degradeLevel)
    } else {
      this.fail('too-slow')
    }
  }

  fail(why) {
    if (this.failed) return
    this.failed = true
    this.sync()
    this.onFail?.(why)
  }

  stats() {
    const f = [...this.frames].sort((a, b) => a - b)
    const pick = (q) => (f.length ? f[Math.min(f.length - 1, Math.floor(q * f.length))] : null)
    const avg = f.length ? f.reduce((a, b) => a + b, 0) / f.length : null
    const gl = this.renderer.getContext()
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      tier: this.tier,
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a',
      dpr: this.dpr,
      css: [this.w, this.h],
      drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      calls: this.lastCalls,
      triangles: this.lastTris,
      points: this.lastPoints,
      programs: this.renderer.info.programs.length,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      compileMs: this.compileMs,
      firstFrameMs: this.firstFrameMs,
      cpuMsAvg: this.cpu && this.cpu.length ? +(this.cpu.reduce((a, b) => a + b, 0) / this.cpu.length).toFixed(2) : null,
      frames: f.length,
      fpsAvg: avg ? 1000 / avg : null,
      frameP50: pick(0.5),
      frameP95: pick(0.95),
      degradeLevel: this.degradeLevel,
      failed: this.failed,
      running: !!this.running, // false while off-screen, the tab is hidden, or failed
      frameCount: this.frameCount,
      paused: !!this.paused,
      oneOffRenders: this.oneOffRenders || 0,
    }
  }

  resetFrames() { this.frames = []; this.cpu = [] }

  dispose() {
    this.running = false
    cancelAnimationFrame(this.raf)
    cancelAnimationFrame(this._req)
    this.ro.disconnect()
    this.io.disconnect()
    document.removeEventListener('visibilitychange', this.onVis)
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}
