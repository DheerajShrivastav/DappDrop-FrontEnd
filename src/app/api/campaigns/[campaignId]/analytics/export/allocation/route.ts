import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { checkCampaignHost, hostCheckUnavailableResponse } from '@/lib/require-host'
import { getLatestAllocation, getPublishedAllocation } from '@/lib/allocation'
import { getLatestNFTAllocation, getPublishedNFTAllocation } from '@/lib/nft-allocation'

function csvField(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * GET /api/campaigns/:campaignId/analytics/export/allocation — CSV export of the allocation
 * table, ERC20 or NFT (P3 CP3, gating updated in P4 to match .../allocations/latest's public
 * dispute-window rule — download the full table, not just view it, per BR-M4). The campaign
 * host gets the true latest tree (draft or published); anyone else gets ONLY the
 * currently-published-on-chain tree, or a 403 if only an unpublished draft exists.
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
  const isHost = hostCheck.kind === 'host'

  let tree: Awaited<ReturnType<typeof getLatestAllocation>> | Awaited<ReturnType<typeof getLatestNFTAllocation>>
  if (isHost) {
    const erc20Tree = await getLatestAllocation(campaignId)
    tree = erc20Tree ?? (await getLatestNFTAllocation(campaignId))
  } else {
    const erc20Published = await getPublishedAllocation(campaignId)
    tree = erc20Published ?? (await getPublishedNFTAllocation(campaignId))
    if (!tree) {
      const draft = (await getLatestAllocation(campaignId)) ?? (await getLatestNFTAllocation(campaignId))
      if (draft) {
        return NextResponse.json(
          { error: 'This allocation has not been published yet — only the campaign host can view it.' },
          { status: 403 },
        )
      }
    }
  }

  if (!tree) {
    return NextResponse.json({ error: 'No allocation has been proposed for this campaign yet' }, { status: 404 })
  }

  const lines: string[] = []
  if (tree.rewardKind === 'NFT') {
    lines.push('wallet,standard,tokenId,amount,tasksCompleted,version,status')
    for (const e of tree.entries) {
      lines.push(
        [
          csvField(e.wallet),
          csvField(e.nftStandard ?? ''),
          csvField(e.tokenId ?? ''),
          csvField(e.amount),
          e.tasksCompleted,
          tree.version,
          csvField(tree.status),
        ].join(','),
      )
    }
  } else {
    lines.push('wallet,amount,tasksCompleted,version,status')
    for (const e of tree.entries) {
      lines.push(
        [csvField(e.wallet), csvField(e.amount), e.tasksCompleted, tree.version, csvField(tree.status)].join(','),
      )
    }
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="campaign-${campaignId}-allocation.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
