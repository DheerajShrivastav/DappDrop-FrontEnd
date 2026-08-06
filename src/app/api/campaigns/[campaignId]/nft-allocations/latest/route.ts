import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireCampaignHost } from '@/lib/require-host'
import { getLatestNFTAllocation } from '@/lib/nft-allocation'

/**
 * GET /api/campaigns/:campaignId/nft-allocations/latest — host-review screen data, NFT
 * counterpart of .../allocations/latest. All amounts stay in raw base units server-side; the
 * client formats for display only.
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

  const tree = await getLatestNFTAllocation(campaignId)
  if (!tree) {
    return NextResponse.json({ allocation: null })
  }

  return NextResponse.json({
    allocation: {
      version: tree.version,
      root: tree.root,
      tokenAddress: tree.token,
      totalItems: Number(tree.totalAmount),
      policy: tree.policy,
      status: tree.status,
      createdAt: tree.createdAt,
      publishedAt: tree.publishedAt,
      excludedForHumanity: tree.excludedForHumanity,
      entries: tree.entries.map((e) => ({
        wallet: e.wallet,
        standard: e.nftStandard,
        tokenId: e.tokenId,
        amount: e.amount,
        tasksCompleted: e.tasksCompleted,
      })),
    },
  })
}
