import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { getAdminRoles } from '@/lib/admin-auth'

/**
 * GET /api/admin/whoami — which admin roles the SESSION wallet holds, read live on-chain
 * (never a client-side flag or cached DB value). Powers which sections of /admin render;
 * every actual admin action re-checks its own specific role independently server-side too —
 * this endpoint is for UI gating only, never the authorization boundary itself.
 */
export async function GET() {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const roles = await getAdminRoles(walletAddress)
  return NextResponse.json({ walletAddress, roles }, { headers: { 'Cache-Control': 'no-store' } })
}
