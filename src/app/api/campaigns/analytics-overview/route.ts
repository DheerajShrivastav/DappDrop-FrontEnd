import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { getHostOverviewStats } from '@/lib/campaign-funnel'

/**
 * GET /api/campaigns/analytics-overview?campaignIds=1,2,3 — cross-campaign DB-only aggregates
 * for the host dashboard (P3 CP3). Scoped to campaigns the caller actually claims to host;
 * since these are cheap read-only aggregates with no per-campaign secrets, and the campaign
 * IDs are public on-chain data the client already fetched via getCampaignsByHostAddress, this
 * only requires a valid session (not a per-campaign host check) — the caller can only ever see
 * counts for the IDs it already knows about.
 */
export async function GET(request: Request) {
  try {
    await verifyWalletSession()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const idsRaw = searchParams.get('campaignIds') || ''
  const campaignIds = idsRaw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))

  const stats = await getHostOverviewStats(campaignIds)
  return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } })
}
