/**
 * Discord / Telegram invite links: the ONE place that decides whether a link may be shown as a
 * "Join" link, or as the "add our bot" link in the wizard. Pure, no imports: used by the wizard
 * (validate + normalise before saving), the task-metadata API (re-checked on the server), the
 * metadata join in web3-service and the campaign page (checked again before rendering).
 *
 * Only https links on the official hosts pass, and every accepted link is REBUILT from its parsed
 * code, so a query, fragment, port, userinfo or extra path never reaches the page:
 *   Discord   discord.gg/<code> or discord.com/invite/<code>          → https://discord.gg/<code>
 *   Telegram  t.me/<username>, t.me/+<hash>, t.me/joinchat/<hash>,
 *             or the same on telegram.me                              → https://t.me/…
 * Anything else (another host, http:, javascript:, a look-alike domain, a bare word) is not a
 * join link: the page shows no link rather than an arbitrary URL.
 */

const DISCORD_CODE = /^[A-Za-z0-9-]{2,64}$/
/** Telegram public usernames: 5–32 characters, a letter first, then letters, digits or _. */
const TG_USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/
/** Private invite hashes (t.me/+…, t.me/joinchat/…). */
const TG_HASH = /^[A-Za-z0-9_-]{8,64}$/
/** t.me paths that look like usernames but aren't a chat to join. */
const TG_RESERVED = new Set(['joinchat', 'addstickers', 'addemoji', 'addtheme', 'addlist', 'share', 'proxy', 'socks', 'setlanguage', 'confirmphone', 'contact', 'login', 'invoice', 'boost', 'giftcode'])

function parseHttps(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s || s.length > 512) return null
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null
  return u
}

/** Path segments without empty parts ("/invite/abc/" → ["invite", "abc"]). */
const segments = (u: URL) => u.pathname.split('/').filter(Boolean)

/** A Discord server invite → its canonical https://discord.gg/<code>, or null. */
export function discordInviteUrl(raw: unknown): string | null {
  const u = parseHttps(raw)
  if (!u) return null
  const host = u.hostname.toLowerCase()
  const seg = segments(u)
  const code = host === 'discord.gg' && seg.length === 1 ? seg[0] : host === 'discord.com' && seg.length === 2 && seg[0] === 'invite' ? seg[1] : null
  return code && DISCORD_CODE.test(code) ? `https://discord.gg/${code}` : null
}

/** A Telegram group / channel link → its canonical https://t.me/…, or null. */
export function telegramInviteUrl(raw: unknown): string | null {
  const u = parseHttps(raw)
  if (!u) return null
  const host = u.hostname.toLowerCase()
  if (host !== 't.me' && host !== 'telegram.me') return null
  const seg = segments(u)
  if (seg.length === 1 && seg[0].startsWith('+')) {
    const hash = seg[0].slice(1)
    return TG_HASH.test(hash) ? `https://t.me/+${hash}` : null
  }
  if (seg.length === 2 && seg[0].toLowerCase() === 'joinchat') {
    return TG_HASH.test(seg[1]) ? `https://t.me/joinchat/${seg[1]}` : null
  }
  if (seg.length === 1 && TG_USERNAME.test(seg[0]) && !TG_RESERVED.has(seg[0].toLowerCase())) {
    return `https://t.me/${seg[0]}`
  }
  return null
}

/** What a host types → a full URL to check: a missing scheme is added, http:// is upgraded. */
function withHttps(input: string): string {
  if (/^http:\/\//i.test(input)) return 'https://' + input.slice('http://'.length)
  return /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`
}

/**
 * The wizard's Discord invite field → the link to save, or null when it isn't a Discord invite.
 * Also accepts a bare invite code ("yourcode"), as the field's placeholder says.
 */
export function normalizeDiscordInvite(input: string | null | undefined): string | null {
  const s = (input ?? '').trim()
  if (!s) return null
  if (DISCORD_CODE.test(s)) return `https://discord.gg/${s}`
  return discordInviteUrl(withHttps(s))
}

/** The wizard's Telegram invite field → the link to save, or null. Also accepts "@username". */
export function normalizeTelegramInvite(input: string | null | undefined): string | null {
  const s = (input ?? '').trim()
  if (!s) return null
  if (s.startsWith('@')) return telegramInviteUrl(`https://t.me/${s.slice(1)}`)
  return telegramInviteUrl(withHttps(s))
}

export type JoinLink = { href: string; label: 'Join the server' | 'Join the group'; platform: 'Discord' | 'Telegram' }

/**
 * The participant's "Join" link for a JOIN_DISCORD / JOIN_TELEGRAM task, or null when the task
 * has no valid invite link (then no link renders at all).
 */
export function taskJoinLink(task: { type: string; discordInviteLink?: string | null; telegramInviteLink?: string | null } | null | undefined): JoinLink | null {
  if (!task) return null
  if (task.type === 'JOIN_DISCORD') {
    const href = discordInviteUrl(task.discordInviteLink)
    return href ? { href, label: 'Join the server', platform: 'Discord' } : null
  }
  if (task.type === 'JOIN_TELEGRAM') {
    const href = telegramInviteUrl(task.telegramInviteLink)
    return href ? { href, label: 'Join the group', platform: 'Telegram' } : null
  }
  return null
}

/**
 * The wizard's "add the DappDrop bot" link (NEXT_PUBLIC_DISCORD_BOT_INVITE_URL): only an https
 * Discord OAuth authorize URL, else null (the wizard then says it isn't set up).
 */
export function discordBotInviteHref(raw: unknown): string | null {
  const u = parseHttps(raw)
  if (!u) return null
  const host = u.hostname.toLowerCase()
  if (host !== 'discord.com' && host !== 'discordapp.com') return null
  if (!/^\/(api\/)?oauth2\/authorize\/?$/.test(u.pathname) || !u.searchParams.get('client_id')) return null
  return u.toString()
}

/** The DappDrop Telegram bot's username (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME), without "@", or null. */
export function telegramBotName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/^@/, '')
  return TG_USERNAME.test(s) ? s : null
}

type CommunityTask = { type: string; discordInviteLink?: string; telegramInviteLink?: string }
type CommunityMeta = { taskType?: string | null; discordInviteLink?: string | null; telegramInviteLink?: string | null }

/**
 * The campaign page's metadata join for community tasks (web3-service getCampaignByIdWithMetadata).
 * The on-chain DISCORD_JOIN slot is shared by Discord and Telegram, so the chain alone reads every
 * one as JOIN_DISCORD; the saved metadata's taskType says which it is (as verify-task's
 * resolveCanonicalTask does on the server). Only a valid invite link for the task's own platform
 * is attached. Other task types come back unchanged.
 */
export function withCommunityMetadata<T extends CommunityTask>(task: T, meta: CommunityMeta | null | undefined): T {
  if (!meta || (task.type !== 'JOIN_DISCORD' && task.type !== 'JOIN_TELEGRAM')) return task
  if (meta.taskType === 'JOIN_TELEGRAM' || task.type === 'JOIN_TELEGRAM') {
    const link = telegramInviteUrl(meta.telegramInviteLink)
    return { ...task, type: 'JOIN_TELEGRAM', ...(link ? { telegramInviteLink: link } : {}) }
  }
  const link = discordInviteUrl(meta.discordInviteLink)
  return link ? { ...task, discordInviteLink: link } : task
}
