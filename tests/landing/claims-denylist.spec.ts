/**
 * QW-01: permanent claims denylist for the landing page.
 *
 * Every string below was a false or unsupported claim on the old landing page (fact sheet §5) or
 * a link to a channel we don't own (§6). Two scans:
 * - the prerendered HTML of the Monolith pages `/`, `/how-it-works` and `/security` from the
 *   production build (what visitors get);
 * - every source file under src/, with comments stripped (so a dead component or another page
 *   can't keep a false claim around to be re-rendered later).
 *
 * Run after `npm run build`:  npm run test:claims
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const PAGES = ['index', 'how-it-works', 'security'].map((p) => path.join(process.cwd(), `.next/server/app/${p}.html`))

const BANNED_TEXT = [
  '10K+',
  '500+',
  '$2M+',
  '10+ Chains',
  'Palm-scan',
  'No bots',
  'Ditch the bots',
  'Next Billion',
  'Most Popular',
  'Enterprise',
  'Exclusive Roles',
  'Real-time',
  'X402',
  'x402',
  'Free to start',
  'All Systems Operational',
  'Join 500+',
  // Never-say list (fact sheet §5 and §4 corrections).
  'immutable',
  'Immutable',
  'production-ready',
  'trusted by',
  'Trusted by',
]

/** Claims that need context: "audited by …" is banned, the approved "Not audited by a third
 * party yet" (TRS F53) is not. */
const BANNED_PATTERNS: RegExp[] = [/(?<![Nn]ot )\b[Aa]udited by\b/, /\bfully audited\b/i, /\bsecurity audited\b/i]

const BANNED_HREFS = ['t.me/dappdrop', 'discord.gg/dappdrop', 'twitter.com/dappdrop', 'x.com/dappdrop']

function landingHtml(): string {
  for (const p of PAGES) assert.ok(existsSync(p), `${p} not found: run \`npm run build\` first (and keep the pages static).`)
  return PAGES.map((p) => readFileSync(p, 'utf8')).join('\n')
}

/** Visible text only (scripts, styles and tags dropped), for the wording rules below. */
function landingText(): string {
  return landingHtml()
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
}

test('the built landing pages contain none of the banned claims', () => {
  const html = landingHtml()
  const hits = [...BANNED_TEXT.filter((s) => html.includes(s)), ...BANNED_PATTERNS.filter((re) => re.test(html)).map(String)]
  assert.deepEqual(hits, [], `banned claim(s) found: ${hits.join(', ')}`)
})

test('the built landing pages link to no unowned social channel', () => {
  const html = landingHtml()
  const hits = BANNED_HREFS.filter((s) => html.includes(s))
  assert.deepEqual(hits, [], `unowned channel link(s) found: ${hits.join(', ')}`)
})

test('nothing on the landing pages pings', () => {
  assert.ok(!landingHtml().includes('animate-ping'), 'animate-ping found')
})

test('07-wow truth rules: "audited" only as a disclosure, no "open source" without a LICENSE', async () => {
  const text = landingText()
  // Allowed: "Not audited yet", "Not audited by a third party yet", "not an audit", and the FAQ
  // question "Is DappDrop audited?" (answered "Not yet.").
  const audited = [...text.matchAll(/.{0,24}\baudited\b.{0,4}/gi)].map((m) => m[0]).filter((m) => !/\b[Nn]ot audited\b/.test(m) && !/Is DappDrop audited\?/.test(m))
  assert.deepEqual(audited, [], `"audited" outside the disclosure: ${audited.join(' | ')}`)
  const { claims } = await import('../../src/config/claims')
  if (!claims.licenseFile) assert.ok(!/open[ -]source/i.test(text), '"open source" shown without a LICENSE file (C6)')
})

// ---------------------------------------------------------------------------------------------
// Source scan: all of src/, comments stripped.
// ---------------------------------------------------------------------------------------------

const SRC = path.join(process.cwd(), 'src')
const SOURCE_EXT = /\.(tsx?|jsx?|mjs|css|json|md|mdx)$/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (SOURCE_EXT.test(name)) out.push(p)
  }
  return out
}

/** Drops block comments, JSX comments and // line comments (not "://" inside URLs). */
function stripComments(code: string): string {
  return code
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
}

test('no source file under src/ carries a banned claim or link (comments excluded)', () => {
  const hits: string[] = []
  for (const file of walk(SRC)) {
    const code = stripComments(readFileSync(file, 'utf8'))
    for (const s of [...BANNED_TEXT, ...BANNED_HREFS]) {
      if (code.includes(s)) hits.push(`${path.relative(process.cwd(), file)}: "${s}"`)
    }
    for (const re of BANNED_PATTERNS) {
      if (re.test(code)) hits.push(`${path.relative(process.cwd(), file)}: ${re}`)
    }
  }
  assert.deepEqual(hits, [], `banned claim(s) in source:\n${hits.join('\n')}`)
})
