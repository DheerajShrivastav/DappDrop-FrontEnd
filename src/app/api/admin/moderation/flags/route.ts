import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { getRecentFlagEvents } from '@/lib/web3-service'

/**
 * GET /api/admin/moderation/flags — recent AccountFlagged history (P3 CP4), wrapping
 * getRecentFlagEvents (bounded RPC scan, the only source of moderation history since
 * _suspiciousActivityScore has no getter). Gated MODERATOR — same role as issuing a flag.
 */
export async function GET() {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    await requireAdminRole(walletAddress, 'MODERATOR')
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  const events = await getRecentFlagEvents()
  return NextResponse.json(
    { events: events.sort((a, b) => b.blockNumber - a.blockNumber) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
