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

// globals.css holds every theme token; the app's stylesheet adds the one red (--ob-danger /
// --pc-danger), loaded on app routes only.
const css =
  readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8') +
  readFileSync(path.join(process.cwd(), 'src/app/(app)/app.css'), 'utf8')

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

// 07-wow: the Monolith themes. Tokens --ob-* (Obsidian) and --pc-* (Porcelain) in globals.css;
// the ink band is --band / --band-text / --band-text-2 / --band-signal in both themes, and the
// printed objects (the example statement, the replicas) use the Porcelain tokens everywhere.
const THEME_PAIRS = [
  ['ink', 'paper', TEXT, 'body text'],
  ['ink', 'surface', TEXT, 'card text'],
  ['ink', 'sunk', TEXT, 'rules band text'],
  ['ink-2', 'paper', TEXT, 'secondary text'],
  ['ink-2', 'surface', TEXT, 'secondary text on cards'],
  ['ink-2', 'sunk', TEXT, 'secondary text on the rules band'],
  ['ink-3', 'paper', TEXT, 'captions, eyebrows'],
  ['ink-3', 'surface', TEXT, 'captions on cards'],
  ['ink-3', 'sunk', TEXT, 'captions on the rules band'],
  ['signal', 'paper', TEXT, 'links, the 24-hour line, eyebrow numbers'],
  ['signal', 'surface', TEXT, 'links on cards'],
  ['signal', 'sunk', TEXT, 'the 24-hour stop on the rules band'],
  ['paper', 'ink', TEXT, 'filled button label'],
  ['paper', 'ink-2', TEXT, 'filled button label, hover'],
  ['band-text', 'band', TEXT, 'ink band text'],
  ['band-text-2', 'band', TEXT, 'ink band secondary text'],
  ['band-signal', 'band', TEXT, 'links on the ink band'],
  ['band', 'band-text', TEXT, 'inverted button on the band'],
  ['rule-strong', 'paper', UI, 'control borders (pills, toggle, chips)'],
  ['rule-strong', 'surface', UI, 'control borders on cards'],
  ['signal', 'paper', UI, 'focus ring'],
  ['signal', 'surface', UI, 'focus ring on cards'],
  ['band-signal', 'band', UI, 'focus ring on the ink band'],
]
for (const [prefix, theme] of [
  ['ob', 'Obsidian'],
  ['pc', 'Porcelain'],
]) {
  for (const [fg, bg, floor, use] of THEME_PAIRS) {
    const a = tokens[`${prefix}-${fg}`]
    const b = tokens[`${prefix}-${bg}`]
    if (!a || !b) {
      failed++
      rows.push({ pair: `${prefix}-${fg} on ${prefix}-${bg}`, use: `${theme}: ${use}`, ratio: 'missing token', floor, ok: false })
      continue
    }
    const r = ratio(a, b)
    const ok = r >= floor
    if (!ok) failed++
    rows.push({ pair: `${prefix}-${fg} on ${prefix}-${bg}`, use: `${theme}: ${use}`, ratio: +r.toFixed(2), floor, ok })
  }
}

// 08-site phase 1: the app's extra pairs, per theme. --on-signal is the page colour in Obsidian
// and the surface colour in Porcelain (app-design §1.1); --danger is the one red (errors and
// failed transactions only); --on-danger is the label on a red fill (never an action).
const APP_PAIRS = {
  ob: [
    ['paper', 'signal', TEXT, 'on-signal: label on the gold reward button / claimable chip'],
    ['danger', 'paper', TEXT, 'error text on the page'],
    ['danger', 'surface', TEXT, 'error text on cards, toasts, dialogs'],
    ['danger', 'sunk', TEXT, 'error text on inputs'],
    ['danger', 'paper', UI, 'error border on the page'],
    ['danger', 'sunk', UI, 'error border on an input'],
    ['paper', 'danger', TEXT, 'on-danger: label on a red fill'],
    ['rule-strong', 'sunk', UI, 'input border on sunk'],
    ['ink-3', 'sunk', TEXT, 'placeholder text in inputs'],
  ],
  pc: [
    ['surface', 'signal', TEXT, 'on-signal: label on the gold reward button / claimable chip'],
    ['danger', 'paper', TEXT, 'error text on the page'],
    ['danger', 'surface', TEXT, 'error text on cards, toasts, dialogs'],
    ['danger', 'sunk', TEXT, 'error text on inputs'],
    ['danger', 'paper', UI, 'error border on the page'],
    ['danger', 'sunk', UI, 'error border on an input'],
    ['surface', 'danger', TEXT, 'on-danger: label on a red fill'],
    ['rule-strong', 'sunk', UI, 'input border on sunk'],
    ['ink-3', 'sunk', TEXT, 'placeholder text in inputs'],
  ],
}
for (const [prefix, pairs] of Object.entries(APP_PAIRS)) {
  const theme = prefix === 'ob' ? 'Obsidian' : 'Porcelain'
  for (const [fg, bg, floor, use] of pairs) {
    const a = tokens[`${prefix}-${fg}`]
    const b = tokens[`${prefix}-${bg}`]
    if (!a || !b) {
      failed++
      rows.push({ pair: `${prefix}-${fg} on ${prefix}-${bg}`, use: `${theme} app: ${use}`, ratio: 'missing token', floor, ok: false })
      continue
    }
    const r = ratio(a, b)
    const ok = r >= floor
    if (!ok) failed++
    rows.push({ pair: `${prefix}-${fg} on ${prefix}-${bg}`, use: `${theme} app: ${use}`, ratio: +r.toFixed(2), floor, ok })
  }
}
// The red must never pass for the gold (an error must not look like a call to action): their
// mutual contrast is reported, and the hue gap is checked (≥ 20° on the colour wheel).
const hue = (h) => {
  const [r, g, b] = rgb(h).map((c) => c / 255)
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  if (mx === mn) return 0
  const d = mx - mn
  const x = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return x * 60
}
for (const prefix of ['ob', 'pc']) {
  const gap = Math.abs(hue(tokens[`${prefix}-danger`]) - hue(tokens[`${prefix}-signal`]))
  const ok = Math.min(gap, 360 - gap) >= 20
  if (!ok) failed++
  rows.push({ pair: `${prefix}-danger vs ${prefix}-signal`, use: 'hue gap (red ≠ gold)', ratio: `${Math.round(Math.min(gap, 360 - gap))}°`, floor: '≥ 20°', ok })
}

console.table(rows)
if (failed) {
  console.error(`contrast-check: ${failed} pair(s) failed`)
  process.exit(1)
}
console.log(`contrast-check: all ${rows.length} pairs pass`)
