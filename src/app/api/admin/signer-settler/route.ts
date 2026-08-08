import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { hasAdminRole, requireAdminRole } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { getRecentSettlerActivity } from '@/lib/web3-service'

/**
 * GET /api/admin/signer-settler — SIGNER_ROLE/SETTLER_ROLE health, VISIBILITY ONLY (P3 CP4).
 * Rotation itself is a deploy-time/CLI action, not something this UI can do.
 *
 * Plain AccessControl (not AccessControlEnumerable) has no way to enumerate role HOLDERS on
 * chain — so this does not list "who holds SIGNER_ROLE". It reports:
 *   - whether the CONNECTED (session) wallet itself holds SIGNER_ROLE / SETTLER_ROLE
 *   - last-signed-at: most recent AttestationRecord.createdAt (the backend signer's own
 *     activity log — src/lib/signer.ts writes one row per signature issued)
 *   - last-fallback-action-at: most recent SETTLER_ROLE event from getRecentSettlerActivity
 *     (FallbackRootPublished / FallbackClosed — same bounded-scan shape as moderation flags)
 * Gated DEFAULT_ADMIN.
 */
export async function GET() {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    await requireAdminRole(walletAddress, 'DEFAULT_ADMIN')
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  const [connectedWalletIsSigner, connectedWalletIsSettler, lastAttestation, settlerActivity] = await Promise.all([
    hasAdminRole(walletAddress, 'SIGNER'),
    hasAdminRole(walletAddress, 'SETTLER'),
    prisma.attestationRecord.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, signerAddress: true, campaignId: true, taskIndex: true },
    }),
    getRecentSettlerActivity(),
  ])

  const sortedSettlerActivity = settlerActivity.sort((a, b) => b.blockNumber - a.blockNumber)

  return NextResponse.json(
    {
      connectedWallet: { address: walletAddress, isSigner: connectedWalletIsSigner, isSettler: connectedWalletIsSettler },
      lastSignedAt: lastAttestation?.createdAt ?? null,
      lastSignerAddress: lastAttestation?.signerAddress ?? null,
      lastFallbackAction: sortedSettlerActivity[0] ?? null,
      recentSettlerActivity: sortedSettlerActivity.slice(0, 20),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
