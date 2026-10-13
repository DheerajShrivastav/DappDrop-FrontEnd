'use client'
// Client island for the vault stage. Decides, cheapest check first, whether the 3D runs at all:
//   reduced motion -> Save-Data -> very low memory -> WebGL2 without a major performance caveat
//   -> GPU denylist (software GL, old mobile GPUs).
// Any "no" leaves the designed poster up (html.vault-fallback). Otherwise it draws the poster into a
// 2D canvas at once (canvas is not an LCP candidate), waits for load + idle (the SSR'd H1 has long been
// painted), then dynamic-imports the three.js scene: the only route into the vault chunk.
import { useEffect } from 'react'

type Tier = 'high' | 'medium' | 'low'
type VaultApi = {
  dispose: () => void
  setPaused: (p: boolean) => void
  goto: (t: number) => void
  snap: () => void
  glide: (t: number, d: number) => Promise<void>
  stats: () => unknown
  setTheme: (t: string) => void
}
declare global {
  interface Window {
    __vault?: Partial<VaultApi> & { ready?: boolean; fallback?: string; tier?: Tier }
  }
}

function probe(): { ok: true; renderer: string } | { ok: false; why: string } {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    if (!gl) return { ok: false, why: 'no-webgl2' }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) return { ok: false, why: 'software-gl' }
    if (/Mali-(4\d\d|T[6-7]\d\d)|Adreno \(TM\) [2-5]\d\d|PowerVR SGX|PowerVR Rogue G/i.test(renderer)) return { ok: false, why: 'weak-gpu' }
    return { ok: true, renderer }
  } catch {
    return { ok: false, why: 'no-webgl2' }
  }
}

function pickTier(renderer: string): Tier {
  const forced = new URLSearchParams(location.search).get('vault')
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const coarse = matchMedia('(pointer: coarse)').matches
  if ((coarse && Math.min(screen.width, screen.height) < 820) || (mem !== undefined && mem <= 4)) return 'low'
  // Apple silicon and discrete NVIDIA/AMD handle the transmission + reflection passes at 60 fps.
  if (/Apple|NVIDIA|GeForce|RTX|Quadro|Radeon (RX|Pro)/i.test(renderer)) return 'high'
  return 'medium' // Intel/AMD integrated, unknown or masked renderer strings
}

function drawPlaceholder(canvas: HTMLCanvasElement) {
  const theme = document.documentElement.dataset.theme === 'porcelain' ? 'porcelain' : 'obsidian'
  const portrait = innerWidth / innerHeight < 1
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    canvas.width = w
    canvas.height = h
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) // object-fit: cover
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
    canvas.dataset.ready = ''
  }
  img.src = `/landing/vault/${theme}-${portrait ? 'portrait' : 'landscape'}.avif`
}

export function VaultIsland() {
  useEffect(() => {
    const html = document.documentElement
    const stage = document.querySelector<HTMLElement>('[data-vault-stage]')
    const host = stage?.querySelector<HTMLElement>('[data-vault-canvas]')
    const placeholder = stage?.querySelector<HTMLCanvasElement>('[data-vault-placeholder]')
    if (!stage || !host || !placeholder) return
    const api: NonNullable<Window['__vault']> = (window.__vault = {})
    let disposed = false
    let scene: VaultApi | null = null

    const fallback = (why: string) => {
      html.classList.add('vault-fallback')
      html.classList.remove('vault-live')
      html.dataset.vaultFallback = why
      api.fallback = why
      api.ready = true
      scene?.dispose()
      scene = null
    }

    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    const undo = () => { html.classList.remove('vault-fallback'); delete html.dataset.vaultFallback; delete window.__vault }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { fallback('reduced-motion'); return undo }
    if (conn?.saveData) { fallback('save-data'); return undo }
    if (mem !== undefined && mem <= 2) { fallback('low-memory'); return undo }
    const gpu = probe()
    if (!gpu.ok) { fallback(gpu.why); return undo }
    const tier = pickTier(gpu.renderer)
    api.tier = tier

    drawPlaceholder(placeholder)
    const onTheme = () => { if (!scene) drawPlaceholder(placeholder) }
    window.addEventListener('dappdrop:themechange', onTheme)

    const start = async () => {
      try {
        // Evaluate the heavy modules in separate tasks, yielding in between (QA M1: no task > 50 ms).
        const yieldTask = () => new Promise<void>((r) => setTimeout(r, 0))
        await import('./engine/warm-three.js')
        await yieldTask()
        await import('./engine/warm-motion.js')
        await yieldTask()
        const mod = await import('./scene/scene.js')
        await yieldTask()
        if (disposed) return
        // ?vaultposter: capture mode for rendering the posters (frozen hero, no grain)
        const posterMode = new URLSearchParams(location.search).has('vaultposter')
        const s = (await mod.mount({
          stage,
          canvasHost: host,
          tier,
          still: posterMode ? 0 : null,
          grain: !posterMode,
          onFail: (why: string) => fallback(why),
          onFirstFrame: () => html.classList.add('vault-live'),
        })) as VaultApi
        if (disposed) { s.dispose(); return }
        scene = s
        Object.assign(api, s, { ready: true })
      } catch (err) {
        console.error('[vault] scene failed, keeping the poster', err)
        fallback('error')
      }
    }
    let idleId = 0
    const idle = () => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
      idleId = ric ? ric(start, { timeout: 2000 }) : window.setTimeout(start, 300)
    }
    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', idle, { once: true })

    return () => {
      disposed = true
      window.removeEventListener('load', idle)
      window.removeEventListener('dappdrop:themechange', onTheme)
      const cic = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback
      if (cic) cic(idleId)
      else clearTimeout(idleId)
      scene?.dispose()
      scene = null
      html.classList.remove('vault-live', 'vault-fallback')
      delete html.dataset.vaultFallback
      delete window.__vault
    }
  }, [])
  return null
}
