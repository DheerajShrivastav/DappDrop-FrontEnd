import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { checkCampaignHost, hostCheckUnavailableResponse } from '@/lib/require-host'
import { getLatestNFTAllocation, getPublishedNFTAllocation } from '@/lib/nft-allocation'

function serializeTree(tree: NonNullable<Awaited<ReturnType<typeof getLatestNFTAllocation>>>) {
  return {
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
  }
}

/**
 * GET /api/campaigns/:campaignId/nft-allocations/latest — NFT counterpart of
 * .../allocations/latest. Same P4 visibility split: host sees their true latest tree (draft or
 * published) plus livePublishedVersion; everyone else sees ONLY the currently-published-on-chain
 * tree, resolved via getPublishedNFTAllocation (never DB status alone). An unpublished draft
 * returns 403; no tree at all returns null. A failed on-chain host check is a retryable 503,
 * never a silent downgrade to the public view.
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

  const hostCheck = await checkCampaignHost(campaignId, verifyWalletSession)
  if (hostCheck.kind === 'unavailable') return hostCheckUnavailableResponse(hostCheck)

  if (hostCheck.kind === 'host') {
    const [tree, published] = await Promise.all([
      getLatestNFTAllocation(campaignId),
      getPublishedNFTAllocation(campaignId),
    ])
    if (!tree) {
      return NextResponse.json({ allocation: null, public: false, livePublishedVersion: null })
    }
    return NextResponse.json(
      {
        allocation: serializeTree(tree),
        public: false,
        livePublishedVersion: published?.version ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const published = await getPublishedNFTAllocation(campaignId)
  if (published) {
    return NextResponse.json(
      { allocation: serializeTree(published), public: true },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const draft = await getLatestNFTAllocation(campaignId)
  if (draft) {
    return NextResponse.json(
      { error: 'This allocation has not been published yet — only the campaign host can view it.' },
      { status: 403 },
    )
  }
  return NextResponse.json({ allocation: null, public: true })
}
