import { createHash, createHmac, timingSafeEqual } from 'crypto'

/**
 * Server-side check of a Telegram Login Widget payload
 * (https://core.telegram.org/widgets/login#checking-authorization):
 *   data_check_string = every received field except `hash`, as "key=value", sorted by key, joined by "\n"
 *   secret_key        = SHA256(bot_token)
 *   valid             ⇔ hex(HMAC_SHA256(data_check_string, secret_key)) === hash
 * plus a freshness check on auth_date so an old, leaked payload can't be replayed forever.
 *
 * Pure apart from crypto (no env, no DB) so it can be tested with any token.
 */

export type TelegramLoginPayload = {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number | string
  hash: string
}

export type TelegramLoginResult =
  | { ok: true; id: string; username: string | null }
  | { ok: false; reason: 'malformed' | 'bad_hash' | 'expired' }

export const TELEGRAM_LOGIN_MAX_AGE_SEC = 24 * 60 * 60

export function verifyTelegramLogin(
  payload: unknown,
  botToken: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  maxAgeSec: number = TELEGRAM_LOGIN_MAX_AGE_SEC,
): TelegramLoginResult {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'malformed' }
  const data = payload as Record<string, unknown>
  const hash = data.hash
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/i.test(hash)) return { ok: false, reason: 'malformed' }
  const id = String(data.id ?? '')
  const authDate = Number(data.auth_date)
  if (!/^\d{1,20}$/.test(id) || !Number.isInteger(authDate)) return { ok: false, reason: 'malformed' }

  // Only scalar fields take part; anything else in the payload is a malformed request.
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(data)) {
    if (k === 'hash') continue
    if (v === undefined || v === null) continue
    if (typeof v !== 'string' && typeof v !== 'number') return { ok: false, reason: 'malformed' }
    entries.push([k, String(v)])
  }
  const dataCheckString = entries
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHash('sha256').update(botToken).digest()
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest()
  const given = Buffer.from(hash.toLowerCase(), 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad_hash' }
  }
  // Signed, so auth_date can't be forged — but a stale signed payload could still be replayed.
  if (authDate > nowSec + 300 || nowSec - authDate > maxAgeSec) return { ok: false, reason: 'expired' }

  const username = typeof data.username === 'string' && /^[A-Za-z0-9_]{4,32}$/.test(data.username) ? data.username : null
  return { ok: true, id, username }
}
