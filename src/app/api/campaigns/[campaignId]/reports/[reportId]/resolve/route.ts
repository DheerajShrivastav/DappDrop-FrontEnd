import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireCampaignHost } from '@/lib/require-host'
import { prisma } from '@/lib/prisma'
import { markReportReviewed } from '@/lib/dispute-reports'

/**
 * POST /api/campaigns/:campaignId/reports/:reportId/resolve (P4 Part 4) — host marks a report
 * REVIEWED with a short response. No SLA, no automated action — this is bookkeeping only; it
 * does not affect claims or the allocation itself. The actual correction path (if any) is
 * re-proposing and republishing a corrected allocation, already reachable from the settlement
 * panel.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string; reportId: string }> },
) {
  const { campaignId: campaignIdRaw, reportId } = await params
  const campaignId = parseInt(campaignIdRaw, 10)
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
  }

  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    await requireCampaignHost(campaignId, walletAddress)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  const report = await prisma.disputeReport.findUnique({ where: { id: reportId } })
  if (!report || report.campaignId !== campaignId) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const hostResponse = typeof body?.hostResponse === 'string' ? body.hostResponse.trim() || null : null

  const updated = await markReportReviewed(reportId, hostResponse)
  return NextResponse.json({ success: true, report: updated })
}
