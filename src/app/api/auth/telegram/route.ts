import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { linkSocialAccount } from '@/lib/social-identity'
import { verifyTelegramLogin } from '@/lib/telegram/login-widget'

/**
 * POST /api/auth/telegram — link a Telegram account to the signed-in wallet.
 * Body: the Telegram Login Widget payload, exactly as the widget returned it. Its hash is checked
 * against TELEGRAM_BOT_TOKEN, so the client can't claim an account it didn't sign in as.
 */
export async function POST(request: Request) {
  let wallet: string
  try {
    wallet = (await verifyWalletSession()).walletAddress
  } catch {
    return NextResponse.json({ error: 'Sign in with your wallet first.' }, { status: 401 })
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return NextResponse.json({ error: 'Telegram sign-in is not configured.' }, { status: 500 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const result = verifyTelegramLogin(payload, botToken)
  if (!result.ok) {
    const error =
      result.reason === 'expired'
        ? 'That Telegram sign-in is too old. Please sign in with Telegram again.'
        : 'Telegram sign-in could not be verified.'
    return NextResponse.json({ error }, { status: 401 })
  }

  const linked = await linkSocialAccount(wallet, 'telegram', { id: result.id, username: result.username })
  if (!linked.ok) {
    return NextResponse.json(
      { error: 'This Telegram account is already connected to another wallet. Disconnect it there first.' },
      { status: 409 },
    )
  }
  return NextResponse.json({ ok: true, telegram: { username: result.username } })
}
