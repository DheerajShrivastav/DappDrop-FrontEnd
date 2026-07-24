import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import config from '@/app/config'

/**
 * SIWE (EIP-4361) server helpers — real Sign-In With Ethereum, replacing the homegrown
 * "Sign this message… Nonce: <timestamp>" scheme (FR-W3/W4, NFR-20).
 *
 * Design:
 * - Server-issued single-use nonce, stored in an httpOnly cookie (double-submit), cleared
 *   on consume. Stateless (no DB migration in P0); the httpOnly + sameSite=strict + short
 *   TTL + clear-on-consume gives single-use + CSRF resistance.
 * - Session is an HMAC-signed token (NEXTAUTH_SECRET) in an httpOnly cookie: one wallet ⇄
 *   one session. No plaintext key material, no external dep.
 *
 * TODO(P1): if multi-instance nonce replay or smart-account (ERC-1271) sign-in matters at
 * beta, move the nonce to a shared store and verify via a viem public client
 * (verifySiweMessage) instead of EOA recoverMessageAddress in the verify route.
 */

export const NONCE_COOKIE = 'siwe-nonce'
export const SESSION_COOKIE = 'siwe-session'
export const NONCE_TTL_SECONDS = 10 * 60 // 10 min to sign
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET is not set — required to sign SIWE sessions')
  return s
}

/** The SIWE domain (RFC 4361 authority) + origin, derived from config, no scheme in domain. */
export function siweDomainAndUri(): { domain: string; uri: string } {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  try {
    const u = new URL(base)
    return { domain: u.host, uri: u.origin }
  } catch {
    return { domain: 'localhost:3000', uri: 'http://localhost:3000' }
  }
}

/** Fresh random nonce (alphanumeric, ≥8 chars per EIP-4361). */
export function generateNonce(): string {
  return randomBytes(16).toString('hex')
}

const b64url = (b: Buffer): string =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function sign(payload: string): string {
  return b64url(createHmac('sha256', secret()).update(payload).digest())
}

/** Issue a signed session token binding `address` with an expiry. */
export function createSessionToken(address: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = b64url(
    Buffer.from(JSON.stringify({ address: address.toLowerCase(), exp })),
  )
  return `${payload}.${sign(payload)}`
}

/** Verify a session token; returns the wallet address or null if invalid/expired. */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot < 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(payload)
  // constant-time compare
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString()) as {
      address: string
      exp: number
    }
    if (!data.address || typeof data.exp !== 'number') return null
    if (Math.floor(Date.now() / 1000) > data.exp) return null
    return data.address.toLowerCase()
  } catch {
    return null
  }
}

/** Active target chain id (SIWE messages must bind the chain the app targets). */
export function activeChainId(): number {
  return config.chainId
}
