/**
 * X (Twitter) intent links for self-reported tasks. Pure, client-safe.
 *
 * The host fields for a handle / post URL arrive in a follow-up; until then this looks for one in
 * what the task already carries (verificationData, then the description). Nothing is ever put in a
 * URL unless it passes a strict pattern — a handle is ^[A-Za-z0-9_]{1,15}$ and a post id is digits
 * only — so a task's free text can't inject anything into the link.
 */

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/
const TWEET_ID_RE = /^\d{1,25}$/
// x.com / twitter.com (+ www./mobile.) /<handle>/status(es)/<id>
const STATUS_URL_RE =
  /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})(?![A-Za-z0-9_])/i
// x.com/<handle> (profile URL)
const PROFILE_URL_RE =
  /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?=[\s/?#),.]|$)/i
// @handle in prose — not part of an email address
const AT_HANDLE_RE = /(?:^|[^A-Za-z0-9_@.])@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_])/

// Path segments that look like handles in a profile URL but aren't.
const RESERVED = new Set(['home', 'intent', 'i', 'search', 'explore', 'settings', 'share', 'hashtag', 'messages', 'notifications'])

export type XTarget = { handle?: string; tweetId?: string }

/** Host-entered fields first (validated again here), then whatever the task's text mentions. */
export function xTargetForTask(task: {
  description?: string
  verificationData?: string
  metadata?: { xHandle?: string | null; xPostId?: string | null } | null
} | null | undefined): XTarget {
  const fromText = parseXTarget(task?.verificationData, task?.description)
  const handle = task?.metadata?.xHandle && HANDLE_RE.test(task.metadata.xHandle) ? task.metadata.xHandle : fromText.handle
  const tweetId = task?.metadata?.xPostId && TWEET_ID_RE.test(task.metadata.xPostId) ? task.metadata.xPostId : fromText.tweetId
  return { handle, tweetId }
}

/** First valid handle / post id found in `sources`, in order. */
export function parseXTarget(...sources: Array<string | undefined | null>): XTarget {
  const out: XTarget = {}
  for (const raw of sources) {
    if (!raw) continue
    const text = raw.trim()
    const status = STATUS_URL_RE.exec(text)
    if (status) {
      if (!out.tweetId && TWEET_ID_RE.test(status[2])) out.tweetId = status[2]
      if (!out.handle && HANDLE_RE.test(status[1])) out.handle = status[1]
    }
    if (!out.handle) {
      const bare = text.replace(/^@/, '')
      const profile = PROFILE_URL_RE.exec(text)
      const at = AT_HANDLE_RE.exec(text)
      const candidate =
        HANDLE_RE.test(bare) ? bare
        : profile && !RESERVED.has(profile[1].toLowerCase()) ? profile[1]
        : at?.[1]
      if (candidate && HANDLE_RE.test(candidate)) out.handle = candidate
    }
    if (out.handle && out.tweetId) break
  }
  return out
}

export type XIntent = { href: string; label: string; specific: boolean }

/** The link for the task's X button: a direct intent when the target is known, else plain X. */
export function xIntentFor(taskType: string, target: XTarget): XIntent {
  if (taskType === 'SOCIAL_FOLLOW' && target.handle) {
    return { href: `https://x.com/intent/follow?screen_name=${target.handle}`, label: `Follow @${target.handle} on X`, specific: true }
  }
  if (taskType === 'SOCIAL_LIKE' && target.tweetId) {
    return { href: `https://x.com/intent/like?tweet_id=${target.tweetId}`, label: 'Like the post on X', specific: true }
  }
  if (taskType === 'RETWEET' && target.tweetId) {
    return { href: `https://x.com/intent/retweet?tweet_id=${target.tweetId}`, label: 'Repost on X', specific: true }
  }
  return { href: 'https://x.com', label: 'Open X', specific: false }
}
