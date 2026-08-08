import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { findEndableCampaigns } from '../../../../../worker/keeper'

const OVERDUE_ALERT_MINUTES = Number(process.env.KEEPER_OVERDUE_ALERT_MINUTES || '30')

/**
 * GET /api/admin/keeper — keeper health (P3 CP4): currently-endable campaigns with overdue
 * flags (BR-K2's own ">30 min overdue" alert threshold) + the recent run log (worker/keeper.ts
 * now persists a KeeperRun row per sweep). Read-only — reuses findEndableCampaigns directly
 * (a plain export, not a route call) rather than duplicating its discovery logic; it does NOT
 * end anything, only discovers. Gated DEFAULT_ADMIN.
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

  const [endable, recentRuns] = await Promise.all([
    findEndableCampaigns(),
    prisma.keeperRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }),
  ])

  const now = Date.now()
  const endableWithOverdue = endable.map((c) => {
    const overdueMinutes = (now - c.endDate.getTime()) / 60000
    return { ...c, overdueMinutes, alert: overdueMinutes > OVERDUE_ALERT_MINUTES }
  })

  return NextResponse.json(
    { endable: endableWithOverdue, recentRuns, overdueAlertMinutes: OVERDUE_ALERT_MINUTES },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
