#!/usr/bin/env node
/**
 * 08-site: first-load JS per route (gzipped), from the build manifests. Run after `next build`.
 *
 *   node scripts/route-first-load.mjs                     # print every page route
 *   node scripts/route-first-load.mjs --json out.json     # also write { route: bytes }
 *   node scripts/route-first-load.mjs --baseline b.json   # compare; exits 1 if an app route
 *                                                         # grows > 10 kB gz or a marketing
 *                                                         # route grows at all (> 0.1 kB slack
 *                                                         # for chunk-hash noise)
 *
 * A route's first load = the root main files + every layout on its path + the page entry,
 * deduplicated, each file gzipped (level 9). Same method for the baseline and the candidate, so
 * the deltas are exact even if the absolute numbers differ slightly from `next build`'s table.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const NEXT = path.join(process.argv.includes('--dir') ? process.argv[process.argv.indexOf('--dir') + 1] : process.cwd(), '.next')
if (!existsSync(path.join(NEXT, 'app-build-manifest.json'))) {
  console.error('No .next build found: run `npm run build` first.')
  process.exit(1)
}
const app = JSON.parse(readFileSync(path.join(NEXT, 'app-build-manifest.json'), 'utf8')).pages
const root = JSON.parse(readFileSync(path.join(NEXT, 'build-manifest.json'), 'utf8')).rootMainFiles ?? []

const gzCache = new Map()
const gz = (f) => {
  if (!gzCache.has(f)) gzCache.set(f, zlib.gzipSync(readFileSync(path.join(NEXT, f)), { level: 9 }).length)
  return gzCache.get(f)
}

const MARKETING = new Set(['/', '/about', '/changelog', '/how-it-works', '/security'])
const out = {}
for (const key of Object.keys(app)) {
  if (!key.endsWith('/page')) continue
  const segs = key.split('/').slice(1, -1) // e.g. ['(app)', 'campaign', '[id]']
  const files = new Set(root)
  const layouts = ['/layout']
  for (let i = 1; i <= segs.length; i++) layouts.push('/' + segs.slice(0, i).join('/') + '/layout')
  for (const l of [...layouts, key]) for (const f of app[l] ?? []) if (f.endsWith('.js')) files.add(f)
  const route = '/' + segs.filter((s) => !/^\(.*\)$/.test(s)).join('/').replace(/%5F/g, '_')
  out[route === '/' ? '/' : route.replace(/\/$/, '')] = [...files].reduce((n, f) => n + gz(f), 0)
}

const argv = process.argv
const jsonAt = argv.indexOf('--json')
if (jsonAt > -1) writeFileSync(argv[jsonAt + 1], JSON.stringify(out, null, 2) + '\n')

const baseAt = argv.indexOf('--baseline')
const base = baseAt > -1 ? JSON.parse(readFileSync(argv[baseAt + 1], 'utf8')) : null
let failed = 0
const rows = Object.entries(out)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([route, bytes]) => {
    const row = { route, kB: +(bytes / 1024).toFixed(2) }
    if (base && base[route] !== undefined) {
      const d = (bytes - base[route]) / 1024
      const limit = MARKETING.has(route) ? 0.1 : 10
      row.baseKB = +(base[route] / 1024).toFixed(2)
      row.deltaKB = +d.toFixed(2)
      row.ok = d <= limit
      if (!row.ok) failed++
    }
    return row
  })
console.table(rows)
if (failed) {
  console.error(`route-first-load: ${failed} route(s) over budget`)
  process.exit(1)
}
