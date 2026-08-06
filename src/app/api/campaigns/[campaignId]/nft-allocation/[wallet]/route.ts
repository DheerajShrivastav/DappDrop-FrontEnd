import { NextResponse } from 'next/server'
import { getNFTAllocationProof } from '@/lib/nft-allocation'

/**
 * GET /api/campaigns/:campaignId/nft-allocation/:wallet — NFT counterpart of
 * /api/campaigns/:campaignId/allocation/:wallet (BR-M4). Public, unauthenticated read — same
 * transparency rationale (the 24h dispute window depends on anyone being able to check any
 * wallet's allocation and proof against the currently published root).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string; wallet: string }> },
) {
  const { campaignId: campaignIdRaw, wallet } = await params
  const campaignId = parseInt(campaignIdRaw, 10)
  if (isNaN(campaignId) || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'Invalid campaignId or wallet' }, { status: 400 })
  }

  try {
    const proof = await getNFTAllocationProof(campaignId, wallet)
    if (!proof) {
      return NextResponse.json({ error: 'No NFT allocation has been proposed for this campaign yet' }, { status: 404 })
    }
    return NextResponse.json(proof, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[nft-allocation proof] error:', e)
    return NextResponse.json({ error: 'Failed to resolve NFT allocation proof' }, { status: 500 })
  }
}
