import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { getKillSwitch } from '@/lib/relayer-gates'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/relayer — relayer spend dashboard (P3 CP4): kill-switch status + budget/spend
 * data already tracked by the relayer since CP1 (CampaignSponsorshipBudget, RelayerDailySpend).
 * Gated DEFAULT_ADMIN (financial/kill-switch visibility, not a moderation-level concern).
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

  const [killSwitch, campaignBudgets, dailySpend, recentClaims] = await Promise.all([
    getKillSwitch(),
    prisma.campaignSponsorshipBudget.findMany({ orderBy: { updatedAt: 'desc' }, take: 25 }),
    prisma.relayerDailySpend.findMany({ orderBy: { date: 'desc' }, take: 14 }),
    prisma.sponsoredClaim.findMany({
      orderBy: { requestedAt: 'desc' },
      take: 25,
      select: {
        id: true,
        campaignId: true,
        account: true,
        kind: true,
        status: true,
        txHash: true,
        gasCostWei: true,
        requestedAt: true,
        processedAt: true,
      },
    }),
  ])

  return NextResponse.json(
    { killSwitch, campaignBudgets, dailySpend, recentClaims },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
