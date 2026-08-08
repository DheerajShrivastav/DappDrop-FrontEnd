import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireCampaignHost } from '@/lib/require-host'
import { getLatestAllocation } from '@/lib/allocation'
import { getLatestNFTAllocation } from '@/lib/nft-allocation'

function csvField(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * GET /api/campaigns/:campaignId/analytics/export/allocation — CSV export of the latest
 * allocation table, ERC20 or NFT (P3 CP3). Host-only. Mirrors the host-review panels'
 * data, so what a host sees in the UI and what they export always match.
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

  const erc20Tree = await getLatestAllocation(campaignId)
  const nftTree = erc20Tree ? null : await getLatestNFTAllocation(campaignId)
  const tree = erc20Tree ?? nftTree

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
