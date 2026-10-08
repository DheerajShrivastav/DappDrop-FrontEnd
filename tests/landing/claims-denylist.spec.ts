/**
 * QW-01: permanent claims denylist for the landing page.
 *
 * Every string below was a false or unsupported claim on the old landing page (fact sheet §5) or
 * a link to a channel we don't own (§6). This test reads the prerendered HTML of `/` from the
 * production build and fails if any of them comes back.
 *
 * Run after `npm run build`:  npm run test:claims
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const HTML_PATH = path.join(process.cwd(), '.next/server/app/index.html')

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
  'audited by',
  'Audited by',
  'immutable',
  'Immutable',
  'production-ready',
  'trusted by',
  'Trusted by',
]

const BANNED_HREFS = ['t.me/dappdrop', 'discord.gg/dappdrop', 'twitter.com/dappdrop', 'x.com/dappdrop']

function landingHtml(): string {
  assert.ok(existsSync(HTML_PATH), `${HTML_PATH} not found: run \`npm run build\` first (and keep / static).`)
  return readFileSync(HTML_PATH, 'utf8')
}

test('the built landing page contains none of the banned claims', () => {
  const html = landingHtml()
  const hits = BANNED_TEXT.filter((s) => html.includes(s))
  assert.deepEqual(hits, [], `banned claim(s) found in /: ${hits.join(', ')}`)
})

test('the built landing page links to no unowned social channel', () => {
  const html = landingHtml()
  const hits = BANNED_HREFS.filter((s) => html.includes(s))
  assert.deepEqual(hits, [], `unowned channel link(s) found in /: ${hits.join(', ')}`)
})

test('nothing on the landing page pings', () => {
  assert.ok(!landingHtml().includes('animate-ping'), 'animate-ping found in /')
})
