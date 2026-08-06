import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireCampaignHost } from '@/lib/require-host'
import { markNFTAllocationPublished } from '@/lib/nft-allocation'
import { AllocationError } from '@/lib/allocation'

/**
 * POST /api/campaigns/:campaignId/nft-allocations/mark-published — called by the client
 * immediately after the host's own setNFTMerkleRoot transaction confirms. Best-effort
 * bookkeeping only (BR-I4): the proof API cross-checks the live on-chain root before ever
 * trusting a tree's status.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId: campaignIdRaw } = await params
  const campaignId = parseInt(campaignIdRaw, 10)
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const version = Number(body?.version)
  if (!Number.isInteger(version) || version <= 0) {
    return NextResponse.json({ error: 'A valid version is required' }, { status: 400 })
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

  try {
    await markNFTAllocationPublished(campaignId, version)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e instanceof AllocationError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[nft-allocations/mark-published] error:', e)
    return NextResponse.json({ error: 'Failed to update NFT allocation status' }, { status: 500 })
  }
}
