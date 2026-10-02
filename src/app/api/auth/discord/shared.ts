import { NextResponse } from 'next/server'

export const DISCORD_OAUTH_STATE_COOKIE = 'discord_oauth_state'

/** Unchanged: NEXTAUTH_URL drives it, so it must match the Discord app's allowed redirect. */
export function discordRedirectUri(): string {
  return process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/auth/discord/callback`
    : 'http://localhost:3000/api/auth/discord/callback'
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')

/**
 * The popup's result page. It carries NO identity data: the link is stored server-side and the
 * opener re-reads it from /api/auth/linked-accounts. The message only says "done, refresh"
 * and is posted to this site's own origin — never to a caller-supplied one (the old page posted
 * the Discord profile to an origin taken from a ?redirect= parameter, and embedded it in an
 * inline script with JSON.stringify, which doesn't escape `</script>`).
 */
export function linkResultPage(result: { ok: true; username: string | null } | { ok: false; error: string }, status = 200) {
  const title = result.ok ? 'Discord connected' : 'Discord not connected'
  const body = result.ok
    ? `Connected${result.username ? ` as <strong>${escapeHtml(result.username)}</strong>` : ''}. You can close this window.`
    : escapeHtml(result.error)
  // JSON for the script, with "<" escaped so no value can close the <script> element.
  const message = JSON.stringify({ type: 'discord-link-result', ok: result.ok }).replace(/</g, '\\u003c')
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;color:#171717;text-align:center}div{max-width:420px;padding:2rem;border:1px solid #e5e5e5;border-radius:12px;background:#fff}</style>
</head><body><div><h1 style="font-size:1.25rem">${title}</h1><p>${body}</p></div>
<script>
(function () {
  var msg = ${message};
  try { localStorage.setItem('discord_link_result', JSON.stringify(msg)); } catch (e) {}
  if (window.opener) { try { window.opener.postMessage(msg, window.location.origin); } catch (e) {} setTimeout(function () { window.close(); }, 1500); }
})();
</script></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}
