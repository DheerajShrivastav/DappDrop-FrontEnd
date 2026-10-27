import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { getLinkedAccounts, unlinkSocialAccount, type SocialPlatform } from '@/lib/social-identity'

async function sessionWallet(): Promise<string | null> {
  try {
    return (await verifyWalletSession()).walletAddress
  } catch {
    return null
  }
}

/** GET — the signed-in wallet's linked Discord / Telegram accounts (usernames only, no IDs). */
export async function GET() {
  const wallet = await sessionWallet()
  if (!wallet) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const linked = await getLinkedAccounts(wallet)
  return NextResponse.json(
    {
      discord: linked.discord ? { username: linked.discord.username } : null,
      telegram: linked.telegram ? { username: linked.telegram.username } : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** DELETE ?platform=discord|telegram — disconnect. Tasks already verified stay verified, and the
 * account still can't verify those same tasks again for another wallet. */
export async function DELETE(request: Request) {
  const wallet = await sessionWallet()
  if (!wallet) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const platform = new URL(request.url).searchParams.get('platform')
  if (platform !== 'discord' && platform !== 'telegram') {
    return NextResponse.json({ error: 'platform must be discord or telegram' }, { status: 400 })
  }
  await unlinkSocialAccount(wallet, platform as SocialPlatform)
  return NextResponse.json({ ok: true })
}
