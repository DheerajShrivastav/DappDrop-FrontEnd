import { createHmac } from 'crypto'
import { normalizeXHandle, parseXPostUrl } from '@/lib/x-task-fields'

/**
 * Proof-by-post for SOCIAL_POST tasks — a real check, method 'proof-by-post':
 *   1. the participant posts on X with the host's required text AND their personal code,
 *   2. pastes the post URL,
 *   3. we fetch the post through X's public oEmbed endpoint (no auth) and check that the code and
 *      required text are in it and that its REAL author is the participant's saved X handle.
 * Any fetch problem is a clear failure, never a pass.
 *
 * oEmbed was checked live on 2026-10-02: publish.twitter.com/oembed 301-redirects to
 * publish.x.com/oembed, which returns { author_url: "https://x.com/<handle>", html: "<blockquote>…
 * post text…</blockquote>" } for a public post and 404 for a missing one. Protected or deleted
 * posts can't be fetched, so they can't be used as proof.
 */

const OEMBED = 'https://publish.x.com/oembed'
const FETCH_TIMEOUT_MS = 8_000
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ' // no 0/O, 1/I/L: easy to retype

function codeSecret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET is not set')
  return s
}

/**
 * The participant's code for a campaign, e.g. "DD-7F3K9Q". Deterministic (HMAC of campaign +
 * wallet with a server secret), so nothing needs storing and the same wallet always sees the same
 * code — but nobody can compute another wallet's code, and a code only works for its own campaign.
 */
export function postProofCode(campaignId: number, wallet: string, secret: string = codeSecret()): string {
  const mac = createHmac('sha256', `dd-post-proof:${secret}`).update(`${campaignId}:${wallet.toLowerCase()}`).digest()
  let out = ''
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[mac[i] % CODE_ALPHABET.length]
  return `DD-${out}`
}

export type FetchedPost = { authorHandle: string; text: string; url: string }
export type PostFetchResult = { ok: true; post: FetchedPost } | { ok: false; reason: 'not_found' | 'unavailable' }

/** Post text from oEmbed's blockquote: tags stripped, entities decoded, whitespace collapsed. */
export function oembedHtmlToText(html: string): string {
  const quote = /<blockquote[\s\S]*?<\/blockquote>/i.exec(html)?.[0] ?? html
  // Drop the attribution line ("— Name (@handle) Date") so the author's own @handle in it can't
  // satisfy a required @mention.
  const body = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(quote)?.[1] ?? quote
  return body
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchXPost(
  postUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PostFetchResult> {
  const url = `${OEMBED}?url=${encodeURIComponent(postUrl)}&omit_script=1&dnt=true`
  let res: Response
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: 'application/json' } })
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  if (res.status === 404 || res.status === 403) return { ok: false, reason: 'not_found' }
  if (!res.ok) return { ok: false, reason: 'unavailable' }
  let data: { author_url?: unknown; html?: unknown; url?: unknown }
  try {
    data = await res.json()
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  const authorHandle = normalizeXHandle(typeof data.author_url === 'string' ? data.author_url : null)
  if (!authorHandle || typeof data.html !== 'string') return { ok: false, reason: 'unavailable' }
  return { ok: true, post: { authorHandle, text: oembedHtmlToText(data.html), url: typeof data.url === 'string' ? data.url : postUrl } }
}

export type ProofCheck =
  | { ok: true; post: FetchedPost; postId: string }
  | { ok: false; message: string }

const fold = (s: string) => s.normalize('NFKC').toLowerCase()

/** Everything except the "used by another wallet" rule (that needs the DB). */
export async function checkPostProof(params: {
  postUrl: string
  savedHandle: string | null
  code: string
  requiredText: string | null
  fetchImpl?: typeof fetch
}): Promise<ProofCheck> {
  const parsed = parseXPostUrl(params.postUrl)
  if (!parsed) return { ok: false, message: 'Paste the link to your post (x.com/<you>/status/<number>).' }
  const handle = normalizeXHandle(params.savedHandle)
  if (!handle) return { ok: false, message: 'Save your X handle first, then verify.' }

  const fetched = await fetchXPost(parsed.url, params.fetchImpl)
  if (!fetched.ok) {
    return {
      ok: false,
      message:
        fetched.reason === 'not_found'
          ? "Couldn't find that post. Make sure it's public and the link is right."
          : "Couldn't fetch the post from X right now. Please try again in a minute.",
    }
  }
  const { post } = fetched
  if (fold(post.authorHandle) !== fold(handle)) {
    return { ok: false, message: `That post is by @${post.authorHandle}, not your saved handle @${handle}.` }
  }
  const text = fold(post.text)
  if (!text.includes(fold(params.code))) {
    return { ok: false, message: `Your post doesn't include your code ${params.code}.` }
  }
  if (params.requiredText && !text.includes(fold(params.requiredText))) {
    return { ok: false, message: `Your post doesn't include the required text: "${params.requiredText}".` }
  }
  return { ok: true, post, postId: parsed.id }
}
