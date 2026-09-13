import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireCampaignHost } from '@/lib/require-host'
import { proposeAllocation, AllocationError } from '@/lib/allocation'

/**
 * POST /api/campaigns/:campaignId/allocations/propose (BR-M1/M3, host-review trigger).
 * Host-only: runs the allocation pipeline for an Ended campaign and persists a new PROPOSED
 * MerkleTree version for the host to review before publishing (setERC20MerkleRoot) themselves.
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
    const result = await proposeAllocation(campaignId)
    return NextResponse.json({ success: true, allocation: result })
  } catch (e: any) {
    if (e instanceof AllocationError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[allocations/propose] error:', e)
    return NextResponse.json({ error: 'Failed to propose allocation' }, { status: 500 })
  }
}
