import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireCampaignHost } from '@/lib/require-host'
import { prisma } from '@/lib/prisma'
import { isValidEthereumAddress } from '@/lib/validation-utils'

/**
 * POST /api/campaigns/:campaignId/nft-deposits — records deposited NFT items after the host's
 * own depositERC721Rewards/depositERC1155Rewards transaction confirms. Required because the
 * contract exposes no enumerable "every tokenId ever deposited" view (only per-tokenId escrow
 * booleans/amounts and a deposit COUNT event) — this table is the off-chain source of truth the
 * NFT allocation pipeline (src/lib/nft-allocation.ts) reads as its pool of items to assign.
 *
 * Host-only, best-effort from the wizard's perspective (the on-chain deposit already succeeded
 * before this call — a failure here means the pipeline won't know about these items until a
 * retry, not that the deposit itself is lost; the tokens are safely escrowed on-chain either
 * way).
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

  const body = await request.json().catch(() => null)
  const { tokenAddress, standard, items } = body ?? {}
  if (!tokenAddress || !isValidEthereumAddress(tokenAddress)) {
    return NextResponse.json({ error: 'Invalid tokenAddress' }, { status: 400 })
  }
  if (standard !== 'ERC721' && standard !== 'ERC1155') {
    return NextResponse.json({ error: 'standard must be ERC721 or ERC1155' }, { status: 400 })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 })
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
    await prisma.nFTDeposit.createMany({
      data: items.map((it: { tokenId: string; amount?: string }) => ({
        campaignId,
        tokenAddress: tokenAddress.toLowerCase(),
        standard,
        tokenId: String(it.tokenId),
        amount: standard === 'ERC721' ? '1' : String(it.amount ?? '1'),
      })),
      skipDuplicates: true, // idempotent — a retried/duplicate record call is a no-op
    })
    return NextResponse.json({ success: true, recorded: items.length })
  } catch (e) {
    console.error('[nft-deposits] error:', e)
    return NextResponse.json({ error: 'Failed to record NFT deposit' }, { status: 500 })
  }
}
