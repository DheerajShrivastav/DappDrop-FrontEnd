import { timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { linkSocialAccount } from '@/lib/social-identity'
import { DISCORD_OAUTH_STATE_COOKIE, discordRedirectUri, linkResultPage } from '../shared'

const sameString = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * GET /api/auth/discord/callback — finish Discord OAuth and LINK the account to the signed-in
 * wallet server-side. verify-task uses only this stored Discord ID.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const expectedState = request.cookies.get(DISCORD_OAUTH_STATE_COOKIE)?.value
  const state = params.get('state')

  const respond = (result: Parameters<typeof linkResultPage>[0], status?: number) => {
    const res = linkResultPage(result, status)
    res.cookies.set(DISCORD_OAUTH_STATE_COOKIE, '', { path: '/api/auth/discord', maxAge: 0 }) // single use
    return res
  }

  if (!expectedState || !state || !sameString(state, expectedState)) {
    return respond({ ok: false, error: 'This sign-in link expired or was not started here. Close this window and try again.' }, 400)
  }
  if (params.get('error')) {
    return respond({ ok: false, error: 'Discord authorization was cancelled.' })
  }
  const code = params.get('code')
  if (!code) return respond({ ok: false, error: 'No authorization code received from Discord.' }, 400)

  let wallet: string
  try {
    wallet = (await verifyWalletSession()).walletAddress
  } catch {
    return respond({ ok: false, error: 'Your wallet sign-in expired. Sign in again, then connect Discord.' }, 401)
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) return respond({ ok: false, error: 'Discord sign-in is not configured.' }, 500)

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: discordRedirectUri(),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!tokenRes.ok) {
      console.warn('[discord] token exchange failed', tokenRes.status, (await tokenRes.text()).slice(0, 200))
      return respond({ ok: false, error: 'Discord did not accept the sign-in. Please try again.' }, 502)
    }
    const { access_token } = (await tokenRes.json()) as { access_token?: string }
    if (!access_token) return respond({ ok: false, error: 'Discord did not return an access token.' }, 502)

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!userRes.ok) return respond({ ok: false, error: 'Could not read your Discord profile.' }, 502)
    const user = (await userRes.json()) as { id?: string; username?: string }
    if (!user.id || !/^\d{5,25}$/.test(user.id)) return respond({ ok: false, error: 'Discord returned an invalid account.' }, 502)

    const username = typeof user.username === 'string' ? user.username.slice(0, 64) : null
    const linked = await linkSocialAccount(wallet, 'discord', { id: user.id, username })
    if (!linked.ok) {
      return respond({ ok: false, error: 'This Discord account is already connected to another wallet. Disconnect it there first.' }, 409)
    }
    return respond({ ok: true, username })
  } catch (e) {
    console.error('[discord] callback error:', e)
    return respond({ ok: false, error: 'Could not reach Discord. Please try again.' }, 502)
  }
}
