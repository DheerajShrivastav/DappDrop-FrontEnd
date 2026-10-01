/**
 * Checks for the SIWE domain allowlist (src/lib/siwe-domains.ts). The repo has no test runner,
 * so this is a plain script:   npx tsx scripts/check-siwe-domains.ts
 * Exits non-zero if any case fails.
 */
import {
  describeSiweDomain,
  isAllowedSiweDomain,
  normalizeHost,
  siweAllowedDomains,
  siweFailureReason,
} from '../src/lib/siwe-domains'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n       got      ${JSON.stringify(actual)}\n       expected ${JSON.stringify(expected)}`}`)
}

const sorted = (a: string[]) => [...a].sort()

console.log('--- normalizeHost')
check('plain host', normalizeHost('Example.COM'), 'example.com')
check('host:port', normalizeHost('localhost:3100'), 'localhost:3100')
check('pasted scheme + trailing slash', normalizeHost('https://dapp-drop.vercel.app/'), 'dapp-drop.vercel.app')
check('pasted https default port dropped', normalizeHost('https://a.app:443'), 'a.app')
check('surrounding space', normalizeHost('  a.app  '), 'a.app')
check('wildcard rejected', normalizeHost('*.vercel.app'), null)
check('path rejected', normalizeHost('a.app/login'), null)
check('inner space rejected', normalizeHost('a .app'), null)
check('empty / undefined', [normalizeHost(''), normalizeHost(undefined)], [null, null])

console.log('--- siweAllowedDomains')
const prod = {
  NODE_ENV: 'production',
  NEXTAUTH_URL: 'https://dapp-drop.vercel.app',
  SIWE_ALLOWED_DOMAINS: 'dapp-drop.dheerajshrivastav.me, other.example.org:8443',
}
check(
  'prod: configured + list, no localhost',
  sorted(siweAllowedDomains(prod)),
  sorted(['dapp-drop.vercel.app', 'dapp-drop.dheerajshrivastav.me', 'other.example.org:8443']),
)
check(
  'dev adds localhost:3000',
  siweAllowedDomains({ NODE_ENV: 'development', NEXTAUTH_URL: 'http://localhost:3000' }),
  ['localhost:3000'],
)
check(
  'preview: VERCEL_URL + VERCEL_BRANCH_URL',
  sorted(
    siweAllowedDomains({
      NODE_ENV: 'production',
      NEXTAUTH_URL: 'https://dapp-drop.vercel.app',
      VERCEL_URL: 'dapp-drop-abc123-team.vercel.app',
      VERCEL_BRANCH_URL: 'dapp-drop-git-feat-x-team.vercel.app',
    }),
  ),
  sorted(['dapp-drop.vercel.app', 'dapp-drop-abc123-team.vercel.app', 'dapp-drop-git-feat-x-team.vercel.app']),
)
check(
  'NEXT_PUBLIC_BASE_URL used when NEXTAUTH_URL is unset',
  siweAllowedDomains({ NODE_ENV: 'production', NEXT_PUBLIC_BASE_URL: 'https://x.example.com' }),
  ['x.example.com'],
)
check(
  'prod with NOTHING configured allows nothing (no localhost fallback)',
  siweAllowedDomains({ NODE_ENV: 'production' }),
  [],
)
check(
  'bad list entries ignored, good ones kept, duplicates collapsed',
  sorted(
    siweAllowedDomains({
      NODE_ENV: 'production',
      SIWE_ALLOWED_DOMAINS: '*.evil.com,https://ok.example.com/,ok.example.com,a.app/path,,  ',
    }),
  ),
  ['ok.example.com'],
)
check(
  'space-separated list works',
  sorted(siweAllowedDomains({ NODE_ENV: 'production', SIWE_ALLOWED_DOMAINS: 'a.example.com b.example.com' })),
  ['a.example.com', 'b.example.com'],
)
check(
  'malformed NEXTAUTH_URL contributes nothing',
  siweAllowedDomains({ NODE_ENV: 'production', NEXTAUTH_URL: 'not a url' }),
  [],
)

console.log('--- isAllowedSiweDomain (exact match)')
const allowed = siweAllowedDomains(prod)
const cases: [string, string | undefined, boolean][] = [
  ['custom domain', 'dapp-drop.dheerajshrivastav.me', true],
  ['vercel.app alias', 'dapp-drop.vercel.app', true],
  ['listed host with port', 'other.example.org:8443', true],
  ['listed host WITHOUT its port', 'other.example.org', false],
  ['listed host on a different port', 'other.example.org:9999', false],
  ['evil.com', 'evil.com', false],
  ['allowed host as a subdomain of evil', 'dapp-drop.vercel.app.evil.com', false],
  ['allowed host as a prefix of evil', 'dapp-drop.vercel.app.evil.com:443', false],
  ['look-alike prefix', 'evil-dapp-drop.vercel.app', false],
  ['subdomain of an allowed host', 'x.dapp-drop.vercel.app', false],
  ['uppercase variant (not tidied up)', 'DAPP-DROP.VERCEL.APP', false],
  ['trailing dot', 'dapp-drop.vercel.app.', false],
  ['leading space', ' dapp-drop.vercel.app', false],
  ['empty string', '', false],
  ['undefined', undefined, false],
]
for (const [name, d, want] of cases) check(name, isAllowedSiweDomain(d, allowed), want)
check('empty allowlist matches nothing, not even ""', [isAllowedSiweDomain('', []), isAllowedSiweDomain('x', [])], [false, false])

console.log('--- describeSiweDomain (safe to echo)')
check('control chars removed', describeSiweDomain('a\nb\u0000c'), 'a?b?c')
check('long domain truncated', describeSiweDomain('a'.repeat(200)).length, 81)
check('undefined', describeSiweDomain(undefined), 'no domain')

console.log('--- siweFailureReason')
const now = new Date('2026-10-01T12:00:00Z')
check('wrong nonce', siweFailureReason({ nonce: 'x' }, 'y', now).includes('nonce'), true)
check('expired', siweFailureReason({ nonce: 'y', expirationTime: new Date('2026-10-01T11:00:00Z') }, 'y', now).includes('expired'), true)
check('not yet valid', siweFailureReason({ nonce: 'y', notBefore: new Date('2026-10-01T13:00:00Z') }, 'y', now).includes('expired'), true)
check('otherwise malformed', siweFailureReason({ nonce: 'y' }, 'y', now).includes('malformed'), true)

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
