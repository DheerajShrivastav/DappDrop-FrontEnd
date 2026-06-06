import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/campaigns/metadata-batch?ids=1&ids=2&ids=3
 *
 * Returns off-chain metadata (imageUrl, shortDescription, longDescription,
 * rewardName) for multiple campaign IDs in a single DB query.
 * Used by graph-service.ts to avoid N individual /api/campaigns/{id}/image
 * requests when rendering campaign lists fetched from The Graph.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawIds = searchParams.getAll('ids')

    if (rawIds.length === 0) {
      return NextResponse.json({ metadata: {} })
    }

    const campaignIds = rawIds
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id))

    if (campaignIds.length === 0) {
      return NextResponse.json({ metadata: {} })
    }

    const rows = await prisma.campaignCache.findMany({
      where: { campaignId: { in: campaignIds } },
      select: {
        campaignId: true,
        imageUrl: true,
        shortDescription: true,
        longDescription: true,
        rewardName: true,
      },
    })

    const metadata: Record<
      string,
      {
        imageUrl?: string | null
        shortDescription?: string | null
        longDescription?: string | null
        rewardName?: string | null
      }
    > = {}

    for (const row of rows) {
      metadata[row.campaignId.toString()] = {
        imageUrl: row.imageUrl,
        shortDescription: row.shortDescription,
        longDescription: row.longDescription,
        rewardName: row.rewardName,
      }
    }

    return NextResponse.json({ metadata })
  } catch (error) {
    console.error('[metadata-batch] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
