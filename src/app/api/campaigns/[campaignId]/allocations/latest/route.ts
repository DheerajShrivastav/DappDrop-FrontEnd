import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireCampaignHost } from '@/lib/require-host'
import { getLatestAllocation, getCachedTokenInfo } from '@/lib/allocation'

/**
 * GET /api/campaigns/:campaignId/allocations/latest — host-review screen data (BR-M3): the
 * most recent allocation proposal (or published tree), with the full per-wallet table.
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

  const tree = await getLatestAllocation(campaignId)
  if (!tree) {
    return NextResponse.json({ allocation: null })
  }

  // Display-only: decimals/symbol are for formatting amounts in the review table. All
  // amounts in this response stay in on-chain base units — the client formats, never
  // recomputes anything value-bearing from these fields.
  const tokenInfo = await getCachedTokenInfo(tree.token)

  return NextResponse.json({
    allocation: {
      version: tree.version,
      root: tree.root,
      token: tree.token,
      decimals: tokenInfo?.decimals ?? null,
      symbol: tokenInfo?.symbol ?? null,
      totalAmount: tree.totalAmount,
      policy: tree.policy,
      status: tree.status,
      createdAt: tree.createdAt,
      publishedAt: tree.publishedAt,
      entries: tree.entries.map((e) => ({
        wallet: e.wallet,
        amount: e.amount,
        tasksCompleted: e.tasksCompleted,
      })),
    },
  })
}
