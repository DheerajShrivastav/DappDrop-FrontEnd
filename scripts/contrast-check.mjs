#!/usr/bin/env node
/**
 * S1-01 / QW-09: contrast gate for the landing tokens.
 *
 * Reads the hex tokens straight from src/app/globals.css (so the gate can't drift from the CSS),
 * checks every pair the page uses against its WCAG 2.2 floor, and checks that the banned pairs
 * really are below the floor (if one ever passes, the ban list is stale). Port of the studio's
 * landing-studio/01-audits/A11-data/contrast-calc.mjs (same luminance maths).
 *
 *   node scripts/contrast-check.mjs          # exits 1 on any failure
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

/** --name: #RRGGBB tokens, and --status-*: H S% L% tokens (converted to hex). */
const tokens = {}
for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[m[1]] = m[2].toLowerCase()
for (const m of css.matchAll(/--(status-[a-z]+-[a-z]+):\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/g)) {
  tokens[m[1]] = hslToHex(+m[2], +m[3], +m[4])
}
tokens.white = '#ffffff'

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (h) => {
  const [r, g, b] = rgb(h)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const ratio = (a, b) => {
  const x = lum(a)
  const y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const TEXT = 4.5
const UI = 3

// [foreground token, background token, floor, what it's for]
const REQUIRED = [
  ['ink', 'paper', TEXT, 'body text'],
  ['ink', 'surface', TEXT, 'slip text'],
  ['ink', 'sunk', TEXT, 'ribbon text'],
  ['ink-2', 'paper', TEXT, 'secondary text'],
  ['ink-2', 'surface', TEXT, 'secondary text on slips'],
  ['ink-2', 'sunk', TEXT, 'chip labels on sunk'],
  ['ink-3', 'paper', TEXT, 'captions'],
  ['ink-3', 'surface', TEXT, 'captions on slips'],
  ['ink-3', 'sunk', TEXT, 'captions on sunk'],
  ['signal', 'paper', TEXT, 'links, the 24-hour line'],
  ['signal', 'surface', TEXT, 'links on slips'],
  ['signal', 'sunk', TEXT, 'the 24-hour stop on the ribbon'],
  ['surface', 'signal', TEXT, 'text on an accent fill'],
  ['paper', 'ink', TEXT, 'primary button label, ink band text'],
  ['paper-2', 'ink', TEXT, 'secondary text on the ink band'],
  ['signal-on-ink', 'ink', TEXT, 'links on the ink band'],
  ['rule-strong', 'paper', UI, 'control borders on paper'],
  ['rule-strong', 'surface', UI, 'control borders on slips'],
  ['ink-3', 'sunk', UI, 'control borders on sunk (A11 rule 1)'],
  ['signal', 'paper', UI, 'focus ring on paper'],
  ['signal', 'surface', UI, 'focus ring on slips'],
  ['signal-on-ink', 'ink', UI, 'focus ring on the ink band'],
  ['ink', 'paper', UI, 'primary button edge'],
  ['status-open-fg', 'status-open-bg', TEXT, 'status chip'],
  ['status-claimable-fg', 'status-claimable-bg', TEXT, 'status chip'],
  ['status-pending-fg', 'status-pending-bg', TEXT, 'status chip'],
  ['status-closed-fg', 'status-closed-bg', TEXT, 'status chip'],
  ['status-cancelled-fg', 'status-cancelled-bg', TEXT, 'status chip'],
  ['status-open-solid', 'paper', UI, 'status dot'],
  ['status-claimable-solid', 'paper', UI, 'status dot'],
  ['status-pending-solid', 'paper', UI, 'status dot'],
  ['status-cancelled-solid', 'paper', UI, 'status dot'],
]

// Plan §3.1 bans: these must stay BELOW the text floor, so they're never used for text.
const BANNED = [
  ['ink-3', 'ink', TEXT, 'ink-3 on the ink band'],
  ['signal', 'ink', TEXT, 'accent on the ink band'],
  ['rule-strong', 'sunk', UI, 'rule-strong as a control border on sunk'],
]

let failed = 0
const rows = []
for (const [fg, bg, floor, use] of REQUIRED) {
  if (!tokens[fg] || !tokens[bg]) {
    failed++
    rows.push({ pair: `${fg} on ${bg}`, use, ratio: 'missing token', floor, ok: false })
    continue
  }
  const r = ratio(tokens[fg], tokens[bg])
  const ok = r >= floor
  if (!ok) failed++
  rows.push({ pair: `${fg} on ${bg}`, use, ratio: +r.toFixed(2), floor, ok })
}
for (const [fg, bg, floor, use] of BANNED) {
  const r = ratio(tokens[fg], tokens[bg])
  const ok = r < floor
  if (!ok) failed++
  rows.push({ pair: `${fg} on ${bg}`, use: `BANNED: ${use}`, ratio: +r.toFixed(2), floor: `< ${floor}`, ok })
}

console.table(rows)
if (failed) {
  console.error(`contrast-check: ${failed} pair(s) failed`)
  process.exit(1)
}
console.log(`contrast-check: all ${rows.length} pairs pass`)
