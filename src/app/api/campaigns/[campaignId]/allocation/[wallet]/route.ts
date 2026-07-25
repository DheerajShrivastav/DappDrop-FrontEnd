import { NextResponse } from 'next/server'
import { getAllocationProof } from '@/lib/allocation'

/**
 * GET /api/campaigns/:campaignId/allocation/:wallet (BR-M4). Public, unauthenticated read —
 * this is the transparency mechanism the 24h dispute window depends on: anyone must be able
 * to check any wallet's allocation and proof against the currently published root, including
 * during the review window before self-serving a claim (FR-C2).
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
    const proof = await getAllocationProof(campaignId, wallet)
    if (!proof) {
      return NextResponse.json({ error: 'No allocation has been proposed for this campaign yet' }, { status: 404 })
    }
    return NextResponse.json(proof, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('[allocation proof] error:', e)
    return NextResponse.json({ error: 'Failed to resolve allocation proof' }, { status: 500 })
  }
}
