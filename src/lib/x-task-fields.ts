/**
 * Host-entered X (Twitter) task fields, stored in CampaignTaskMetadata.metadata:
 *   SOCIAL_FOLLOW            → xHandle
 *   SOCIAL_LIKE / RETWEET    → xPostId (+ xPostUrl as entered, for display)
 *   SOCIAL_POST              → xRequiredText (text, #hashtag or @mention the post must contain)
 * Pure; used by the wizard schema, the participant UI and the server. Every value is re-validated
 * where it's used, so stored data can never put anything but a handle / digits into a URL.
 */

export const X_HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/
export const X_POST_ID_RE = /^\d{1,25}$/
export const X_REQUIRED_TEXT_MAX = 200

/** "@Name", "Name", "x.com/Name" or "https://twitter.com/Name" → "Name"; null if not a valid handle. */
export function normalizeXHandle(input: string | null | undefined): string | null {
  if (!input) return null
  let s = input.trim()
  const url = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(s)
  if (url) s = url[1]
  s = s.replace(/^@/, '')
  return X_HANDLE_RE.test(s) ? s : null
}

/** An x.com / twitter.com post URL → its numeric id and the handle in its path. */
export function parseXPostUrl(input: string | null | undefined): { id: string; handle: string; url: string } | null {
  if (!input) return null
  const m = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})(?:[/?#].*)?$/i.exec(input.trim())
  if (!m) return null
  return { handle: m[1], id: m[2], url: `https://x.com/${m[1]}/status/${m[2]}` }
}

export function normalizeRequiredText(input: string | null | undefined): string | null {
  const s = (input ?? '').replace(/\s+/g, ' ').trim()
  return s && s.length <= X_REQUIRED_TEXT_MAX ? s : null
}
