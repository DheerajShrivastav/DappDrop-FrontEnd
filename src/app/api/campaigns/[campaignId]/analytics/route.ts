import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireCampaignHost } from '@/lib/require-host'
import { getCampaignByIdWithMetadata } from '@/lib/web3-service'
import { getCampaignFunnelAnalytics } from '@/lib/campaign-funnel'

/**
 * GET /api/campaigns/:campaignId/analytics — host-only funnel/completion/claim analytics
 * (P3 CP3). Read-only, no contract surface; see src/lib/campaign-funnel.ts for sourcing.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId: campaignIdRaw } = await params
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

  const campaign = await getCampaignByIdWithMetadata(String(campaignId))
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  try {
    const analytics = await getCampaignFunnelAnalytics(campaign)
    return NextResponse.json(analytics, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[campaign analytics] error:', e)
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 })
  }
}
