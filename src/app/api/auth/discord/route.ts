import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { DISCORD_OAUTH_STATE_COOKIE, discordRedirectUri, linkResultPage } from './shared'

/**
 * GET /api/auth/discord — start linking a Discord account to the signed-in wallet (opened in a
 * popup). Scope `identify` only. A random `state` is bound to this browser in an httpOnly cookie
 * and checked on the callback, so a forged callback (someone else's code) can't link their
 * Discord account to this wallet.
 */
export async function GET() {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    return linkResultPage({ ok: false, error: 'Discord sign-in is not configured.' }, 500)
  }
  try {
    await verifyWalletSession()
  } catch {
    return linkResultPage({ ok: false, error: 'Sign in with your wallet first, then connect Discord.' }, 401)
  }

  const state = randomBytes(24).toString('hex')
  const url = new URL('https://discord.com/api/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', discordRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'identify')
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'consent')

  const response = NextResponse.redirect(url.toString())
  response.cookies.set(DISCORD_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: '/api/auth/discord',
    sameSite: 'lax', // sent on Discord's top-level redirect back to the callback
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
