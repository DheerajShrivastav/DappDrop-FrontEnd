import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { getXHandle, setXHandle } from '@/lib/social-identity'
import { normalizeXHandle } from '@/lib/x-task-fields'

async function sessionWallet(): Promise<string | null> {
  try {
    return (await verifyWalletSession()).walletAddress
  } catch {
    return null
  }
}

/** GET — the signed-in wallet's saved X handle (self-entered, unverified). */
export async function GET() {
  const wallet = await sessionWallet()
  if (!wallet) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  return NextResponse.json({ xHandle: await getXHandle(wallet) }, { headers: { 'Cache-Control': 'no-store' } })
}

/** PUT { xHandle } — save it once per wallet; empty clears it. */
export async function PUT(request: Request) {
  const wallet = await sessionWallet()
  if (!wallet) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { xHandle } = (await request.json().catch(() => ({}))) as { xHandle?: unknown }
  if (xHandle === '' || xHandle === null) {
    await setXHandle(wallet, null)
    return NextResponse.json({ xHandle: null })
  }
  const handle = normalizeXHandle(typeof xHandle === 'string' ? xHandle : null)
  if (!handle) return NextResponse.json({ error: 'Enter a valid X handle (letters, numbers, _; up to 15).' }, { status: 400 })
  await setXHandle(wallet, handle)
  return NextResponse.json({ xHandle: handle })
}
