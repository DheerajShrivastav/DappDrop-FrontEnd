/**
 * Which hosts the SIWE verify endpoint accepts as the message's `domain`.
 *
 * The domain is the anti-phishing field of EIP-4361: the wallet shows it to the user and the
 * server refuses a message that was signed for a different site. It used to be ONE host derived
 * from NEXTAUTH_URL, so sign-in broke on every other address the same deployment is served from
 * — a custom domain, the *.vercel.app alias, every preview URL — because the client signs
 * `window.location.host`.
 *
 * Pure (reads only the env object it's given, no 'server-only', no Next imports) so the matrix
 * can be exercised directly with `npx tsx scripts/check-siwe-domains.ts`; src/lib/siwe.ts
 * re-exports it for the server.
 *
 * SECURITY: only operator-set config goes in here — SIWE_ALLOWED_DOMAINS, NEXTAUTH_URL /
 * NEXT_PUBLIC_BASE_URL and Vercel's own system variables. NEVER add anything taken from the
 * request (the Host header, a forwarded host, the message itself): that would let the attacker
 * choose the domain they're checked against.
 */

export type EnvLike = Record<string, string | undefined>

// host[:port], lowercase. No scheme, path, wildcard or whitespace.
const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/

/**
 * One configured entry -> a bare lowercase `host[:port]`, or null if it isn't one.
 * Forgives the two easy env-var slips (a pasted `https://…` and a trailing slash) but rejects
 * wildcards, paths and anything else: an entry that doesn't parse must be IGNORED, never
 * guessed at — a mangled entry that matched more than intended would widen the allowlist.
 */
export function normalizeHost(raw: string | undefined | null): string | null {
  if (!raw) return null
  let s = raw.trim().toLowerCase()
  if (!s) return null
  if (s.includes('://')) {
    try {
      s = new URL(s).host
    } catch {
      return null
    }
  }
  s = s.replace(/\/+$/, '')
  return HOST_RE.test(s) ? s : null
}

/** The host of the site's own configured base URL (NEXTAUTH_URL, else NEXT_PUBLIC_BASE_URL). */
export function configuredSiweHost(env: EnvLike = process.env): string | null {
  const base = env.NEXTAUTH_URL || env.NEXT_PUBLIC_BASE_URL
  if (!base) return null
  try {
    return normalizeHost(new URL(base).host)
  } catch {
    return null
  }
}

const warned = new Set<string>()
function warnOnce(key: string, text: string) {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(text)
}

/**
 * Hosts a SIWE message may be signed for. Exact match, port included — no wildcards or suffix
 * matching, because `evil.com` must never ride on `*.vercel.app`-style rules.
 *   - SIWE_ALLOWED_DOMAINS: comma/space-separated hosts (the escape hatch for custom domains)
 *   - the host of NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL (the original behaviour)
 *   - VERCEL_URL and VERCEL_BRANCH_URL: set by the platform for THIS deployment, so previews
 *     work without configuration and the client can't influence them
 *   - localhost:3000, outside production only
 */
export function siweAllowedDomains(env: EnvLike = process.env): string[] {
  const out = new Set<string>()
  const add = (h: string | null) => {
    if (h) out.add(h)
  }

  for (const entry of (env.SIWE_ALLOWED_DOMAINS ?? '').split(/[,\s]+/)) {
    if (!entry) continue
    const host = normalizeHost(entry)
    if (host) out.add(host)
    else
      warnOnce(
        `bad:${entry}`,
        `[siwe] ignoring SIWE_ALLOWED_DOMAINS entry ${JSON.stringify(entry.slice(0, 80))}: expected a bare host like example.com (a port is allowed; no wildcards, paths or spaces).`,
      )
  }

  add(configuredSiweHost(env))
  add(normalizeHost(env.VERCEL_URL))
  add(normalizeHost(env.VERCEL_BRANCH_URL))
  if (env.NODE_ENV !== 'production') out.add('localhost:3000')

  return [...out]
}

/** Exact match against the allowlist. `domain` comes from the (attacker-controlled) message, so
 * it is deliberately NOT lowercased or trimmed: the real client always signs the lowercase
 * `window.location.host`, and anything that only matches after being "tidied up" is refused. */
export function isAllowedSiweDomain(domain: string | undefined, allowed: string[]): boolean {
  return typeof domain === 'string' && domain.length > 0 && allowed.includes(domain)
}

/** A message-supplied domain made safe to echo in an error / a log line. */
export function describeSiweDomain(domain: string | undefined): string {
  if (!domain) return 'no domain'
  const printable = domain.replace(/[^\x21-\x7e]/g, '?')
  return printable.length > 80 ? `${printable.slice(0, 80)}…` : printable
}

export const SIWE_ERROR_WRONG_SITE = (domain: string | undefined) =>
  `Sign-in message is for a different site (${describeSiweDomain(domain)}). Open the app at its official address and try again.`

/**
 * Why a message that got past the domain check still failed viem's validateSiweMessage, so the
 * client can say something actionable. The order mirrors that function's checks.
 */
export function siweFailureReason(
  message: { nonce?: string; expirationTime?: Date; notBefore?: Date },
  expectedNonce: string,
  now: Date,
): string {
  if (message.nonce !== expectedNonce) {
    return 'Sign-in nonce expired or was already used. Please try connecting again.'
  }
  if (
    (message.expirationTime && now >= message.expirationTime) ||
    (message.notBefore && now < message.notBefore)
  ) {
    return 'Sign-in message has expired. Please try connecting again.'
  }
  return 'Sign-in message is malformed. Please try connecting again.'
}
