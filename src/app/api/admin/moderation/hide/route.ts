import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/moderation/hide — toggles CampaignCache.hiddenFromDiscovery (P3 CP4).
 * OFF-CHAIN ONLY: does not touch escrow, tasks, or claims — a hidden campaign's participants
 * can still complete tasks and claim by direct link, this only controls whether it's surfaced
 * in the public discovery listing (see getAllCampaigns()). Gated MODERATOR.
 */
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}))
  const campaignId = typeof body?.campaignId === 'number' ? body.campaignId : parseInt(body?.campaignId, 10)
  const hidden = Boolean(body?.hidden)
  const reason = typeof body?.reason === 'string' ? body.reason : undefined

  if (!Number.isFinite(campaignId)) {
    return NextResponse.json({ error: 'Valid campaignId is required' }, { status: 400 })
  }
  if (hidden && !reason) {
    return NextResponse.json({ error: 'A reason is required to hide a campaign' }, { status: 400 })
  }

  const cache = await prisma.campaignCache.findFirst({ where: { campaignId } })
  if (!cache) {
    return NextResponse.json({ error: 'Campaign not found in cache' }, { status: 404 })
  }

  const updated = await prisma.campaignCache.update({
    where: { id: cache.id },
    data: { hiddenFromDiscovery: hidden, hiddenReason: hidden ? reason : null },
  })

  return NextResponse.json({
    success: true,
    campaignId,
    hiddenFromDiscovery: updated.hiddenFromDiscovery,
    hiddenReason: updated.hiddenReason,
  })
}
