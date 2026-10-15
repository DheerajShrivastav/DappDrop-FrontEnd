#!/usr/bin/env node
/**
 * QW-09 / QW-03: build-output gates for the landing page. Run after `npm run build`.
 *
 * - `/` must be static (prerendered), never dynamic.
 * - First-load JS for `/` (every script chunk the route loads, gzipped): hard fail > 130 kB,
 *   warning > 115 kB (PRF budget).
 * - No framer-motion, wagmi or RainbowKit code in any chunk `/` loads.
 *
 * Reads the prerendered HTML and Next's manifests instead of a bundle-analyzer dependency.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const NEXT = path.join(process.cwd(), '.next')
const HARD_KB = 130
const WARN_KB = 115

const SIGNATURES = {
  'framer-motion': ['framerAppearId', 'data-framer-appear-id'],
  wagmi: ['WagmiProvider', 'wagmi.'],
  rainbowkit: ['rainbowkit', 'data-rk'],
}

let failures = 0
const fail = (m) => {
  failures++
  console.error(`✖ ${m}`)
}

if (!existsSync(path.join(NEXT, 'app-build-manifest.json'))) {
  console.error('No .next build found: run `npm run build` first.')
  process.exit(1)
}

// 1. Static.
const prerender = JSON.parse(readFileSync(path.join(NEXT, 'prerender-manifest.json'), 'utf8'))
if (!prerender.routes?.['/']) fail('/ is not prerendered (static). Something reads cookies(), headers() or searchParams.')
else console.log('✔ / is static (prerendered)')

// 2. Chunks / loads: every <script src> in the prerendered HTML, plus every chunk named by a
//    client reference in the inline flight data (those load at hydration). Reading the real
//    HTML, not the build manifests, catches chunks pulled in through shared boundaries (the
//    root not-found once dragged the (app) layout's wallet chunks onto /).
const html = readFileSync(path.join(NEXT, 'server/app/index.html'), 'utf8')
const files = new Set()
const noModule = new Set()
for (const m of html.matchAll(/<script([^>]*)src="\/_next\/(static\/chunks\/[^"?]+\.js)"([^>]*)>/g)) {
  // <script noModule> (legacy polyfills) never loads in a modern browser; Next doesn't count it.
  if (/nomodule/i.test(m[1] + m[3])) noModule.add(m[2])
  else files.add(m[2])
}
for (const m of html.matchAll(/static\/chunks\/[^"\\]+?\.js/g)) if (!noModule.has(m[0])) files.add(m[0])
for (const f of files) {
  if (/app\/\(app\)\//.test(f)) fail(`/ loads an (app) route chunk: ${f}`)
}

let totalGz = 0
const rows = []
for (const f of files) {
  const buf = readFileSync(path.join(NEXT, f))
  const gz = zlib.gzipSync(buf, { level: 9 }).length
  totalGz += gz
  rows.push({ chunk: f.replace('static/chunks/', ''), gzKB: +(gz / 1024).toFixed(1) })
  const text = buf.toString('utf8')
  for (const [lib, sigs] of Object.entries(SIGNATURES)) {
    const hit = sigs.find((s) => text.includes(s))
    if (hit) fail(`${lib} code ("${hit}") in a chunk / loads: ${f}`)
  }
}
console.table(rows)
const kb = totalGz / 1024
const line = `first-load JS for / = ${kb.toFixed(1)} kB gzipped (${files.size} chunks)`
if (kb > HARD_KB) fail(`${line} > ${HARD_KB} kB hard cap`)
else if (kb > WARN_KB) console.warn(`⚠ ${line} > ${WARN_KB} kB target`)
else console.log(`✔ ${line} ≤ ${WARN_KB} kB target`)

if (failures === 0) console.log('✔ no framer-motion, wagmi or RainbowKit code on /')
process.exit(failures ? 1 : 0)
