import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { listCampaignsWithOpenReports, computeEscalation } from '@/lib/dispute-reports'
import { getPublishedAllocation } from '@/lib/allocation'
import { getPublishedNFTAllocation } from '@/lib/nft-allocation'

/**
 * GET /api/admin/moderation/reports (P4) — cross-campaign dispute-report visibility for the
 * admin console. Since plain AccessControl gives no way to push a notification to "whoever
 * holds an admin role" (no on-chain role-holder enumeration — see admin-auth.ts), volume
 * escalation here is ALERT-ONLY and surfaced on load, not pushed: a genuinely broken allocation
 * is visible the moment an admin opens this screen while the window is still open. Never
 * automated action. Gated MODERATOR.
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

  const groups = await listCampaignsWithOpenReports()
  const results = await Promise.all(
    groups.map(async (g) => {
      const [cache, erc20Tree, nftTree] = await Promise.all([
        prisma.campaignCache.findFirst({ where: { campaignId: g.campaignId } }),
        getPublishedAllocation(g.campaignId),
        getPublishedNFTAllocation(g.campaignId),
      ])
      const tree = erc20Tree ?? nftTree
      const allocatedWalletCount = tree?.entries.length ?? 0
      const escalation = await computeEscalation(g.campaignId, g.merkleRoot, allocatedWalletCount)
      return {
        campaignId: g.campaignId,
        campaignTitle: cache?.title ?? null,
        hostAddress: cache?.hostAddress ?? null,
        merkleRoot: g.merkleRoot,
        openReportCount: g.openCount,
        allocatedWalletCount,
        escalation,
      }
    }),
  )

  return NextResponse.json(
    { campaigns: results.sort((a, b) => b.openReportCount - a.openReportCount) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
