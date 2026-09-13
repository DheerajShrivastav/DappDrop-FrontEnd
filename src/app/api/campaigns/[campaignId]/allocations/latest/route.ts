import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { checkCampaignHost, hostCheckUnavailableResponse } from '@/lib/require-host'
import { getLatestAllocation, getPublishedAllocation, getCachedTokenInfo } from '@/lib/allocation'

function serializeTree(
  tree: NonNullable<Awaited<ReturnType<typeof getLatestAllocation>>>,
  tokenInfo: { decimals: number; symbol: string } | null,
) {
  return {
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
    // Wallets excluded by humanity gating — surfaced so anyone reviewing during the dispute
    // window can see who was filtered out and why (docs/HUMANITY_GATING.md). Empty otherwise.
    excludedForHumanity: tree.excludedForHumanity,
    entries: tree.entries.map((e) => ({
      wallet: e.wallet,
      amount: e.amount,
      tasksCompleted: e.tasksCompleted,
    })),
  }
}

/**
 * GET /api/campaigns/:campaignId/allocations/latest (P4: BR-M4 public dispute-window
 * transparency, split by status — never just "remove the host gate"):
 *   - The campaign's HOST (SIWE-authenticated) always sees their true latest tree — PROPOSED
 *     draft or PUBLISHED — exactly as before (BR-M3 host review). Also returns
 *     livePublishedVersion (resolved against the live on-chain root, P4 Part 4) so the
 *     settlement panel can tell a first-time publish from a republish that would restart the
 *     24h window for everyone.
 *   - Anyone else (unauthenticated, or authenticated but not this campaign's host) gets ONLY
 *     the tree matching the CURRENTLY PUBLISHED on-chain root — resolved via the same
 *     resolve-against-live-root pattern as getAllocationProof, never from DB status alone, so a
 *     newer unpublished draft (even one superseding an already-published root) can never leak.
 *     No published root yet => nothing to show publicly.
 *   - If the on-chain host check itself fails, that's a 503, NOT a silent downgrade to the
 *     public view — a real host must never be shown "you're not the host" over a node hiccup.
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
      getLatestAllocation(campaignId),
      getPublishedAllocation(campaignId),
    ])
    if (!tree) {
      return NextResponse.json({ allocation: null, public: false, livePublishedVersion: null })
    }
    const tokenInfo = await getCachedTokenInfo(tree.token)
    return NextResponse.json(
      {
        allocation: serializeTree(tree, tokenInfo),
        public: false,
        livePublishedVersion: published?.version ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const published = await getPublishedAllocation(campaignId)
  if (published) {
    const tokenInfo = await getCachedTokenInfo(published.token)
    return NextResponse.json(
      { allocation: serializeTree(published, tokenInfo), public: true },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Nothing published on-chain. If a PROPOSED (unpublished) draft exists, it stays private —
  // 403, not a quiet empty response, since there genuinely is something here the caller can't
  // see. If no tree exists at all, there's nothing to hide either way.
  const draft = await getLatestAllocation(campaignId)
  if (draft) {
    return NextResponse.json(
      { error: 'This allocation has not been published yet — only the campaign host can view it.' },
      { status: 403 },
    )
  }
  return NextResponse.json({ allocation: null, public: true })
}
