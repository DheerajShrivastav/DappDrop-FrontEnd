import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Webhook HMAC signing — the documented, host-reproducible scheme (PRD BR-N*).
 *
 * Pure crypto only: no Prisma, no 'server-only', no env — so the standalone dispatcher worker,
 * the enqueue service, and tests can all import it. The SECRET is passed in by the caller; this
 * module never reads it from storage and never logs it.
 *
 * ── Signing scheme (give this to hosts so they can verify) ─────────────────────────────────
 *   signingString = `${timestamp}.${rawBody}`
 *       timestamp = integer unix SECONDS (also sent as the X-DappDrop-Timestamp header)
 *       rawBody   = the exact bytes of the request body (do NOT re-serialize before verifying)
 *   signature     = hex( HMAC_SHA256(secret, signingString) )
 *
 *   Headers on every delivery (and every retry, UNCHANGED):
 *       X-DappDrop-Event-Id:   <stable event id; use it to dedupe redeliveries>
 *       X-DappDrop-Timestamp:  <timestamp>
 *       X-DappDrop-Signature:  t=<timestamp>,v1=<hex signature>   ← scheme is self-describing
 *
 *   To verify (host side):
 *     1. Read t and v1 from X-DappDrop-Signature (or the discrete timestamp header).
 *     2. Recompute hex(HMAC_SHA256(your_secret, `${t}.${rawBody}`)).
 *     3. Constant-time compare against v1.
 *     4. Reject if |now - t| exceeds your tolerance (replay window) — the timestamp is signed,
 *        so an attacker cannot advance it without the secret. Because retries resend the
 *        ORIGINAL timestamp + signature unchanged, pick a tolerance >= your max retry horizon,
 *        or dedupe on the event id (recommended) rather than relying on the timestamp window.
 */

export const SIGNATURE_HEADER = 'X-DappDrop-Signature'
export const TIMESTAMP_HEADER = 'X-DappDrop-Timestamp'
export const EVENT_ID_HEADER = 'X-DappDrop-Event-Id'

/** The exact string that gets HMAC'd. Kept in one place so signer and verifier never drift. */
export function buildSigningString(timestamp: number | bigint, body: string): string {
  return `${timestamp.toString()}.${body}`
}

/** hex( HMAC_SHA256(secret, `${timestamp}.${body}`) ). Computed ONCE at enqueue, then stored. */
export function computeSignature(secret: string, timestamp: number | bigint, body: string): string {
  return createHmac('sha256', secret).update(buildSigningString(timestamp, body)).digest('hex')
}

/** The self-describing header value: `t=<ts>,v1=<hex>`. */
export function formatSignatureHeader(timestamp: number | bigint, signature: string): string {
  return `t=${timestamp.toString()},v1=${signature}`
}

/** Parse `t=...,v1=...` back into its parts (for verification / tests). */
export function parseSignatureHeader(header: string): { t: string; v1: string } | null {
  const parts = header.split(',').reduce<Record<string, string>>((acc, kv) => {
    const [k, v] = kv.split('=')
    if (k && v) acc[k.trim()] = v.trim()
    return acc
  }, {})
  if (!parts.t || !parts.v1) return null
  return { t: parts.t, v1: parts.v1 }
}

/**
 * Constant-time verify — the reference implementation of what a host does. Recomputes the HMAC
 * over `${timestamp}.${body}` and compares to the provided hex signature without leaking timing.
 */
export function verifySignature(
  secret: string,
  timestamp: number | bigint,
  body: string,
  signature: string,
): boolean {
  const expected = computeSignature(secret, timestamp, body)
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(signature, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
