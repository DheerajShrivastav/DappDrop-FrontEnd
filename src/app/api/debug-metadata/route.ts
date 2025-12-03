// Debug API to check what's in the database
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignIdParam = searchParams.get('campaignId')

    if (!campaignIdParam) {
      return NextResponse.json(
        { error: 'campaignId required' },
        { status: 400 }
      )
    }

    const campaignId = parseInt(campaignIdParam, 10)

    if (isNaN(campaignId)) {
      return NextResponse.json(
        { error: 'campaignId must be a valid number' },
        { status: 400 }
      )
    }

    // Get all metadata for this campaign
    const allMetadata = await prisma.campaignTaskMetadata.findMany({
      where: {
        campaignId,
      },
      orderBy: {
        taskIndex: 'asc',
      },
    })


    return NextResponse.json({
      success: true,
      campaignId,
      count: allMetadata.length,
      metadata: allMetadata,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Database error', details: error.message },
      { status: 500 }
    )
  }
}
