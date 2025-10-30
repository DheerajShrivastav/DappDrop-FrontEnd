// Debug API to check what's in the database
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId required' },
        { status: 400 }
      )
    }

    console.log('🔍 Checking database for campaign:', campaignId)

    // Get all metadata for this campaign
    const allMetadata = await prisma.campaignTaskMetadata.findMany({
      where: {
        campaignId: campaignId,
      },
      orderBy: {
        taskIndex: 'asc',
      },
    })

    console.log('📦 Found metadata entries:', allMetadata)

    return NextResponse.json({
      success: true,
      campaignId,
      count: allMetadata.length,
      metadata: allMetadata,
    })
  } catch (error: any) {
    console.error('❌ Error checking metadata:', error)
    return NextResponse.json(
      { error: 'Database error', details: error.message },
      { status: 500 }
    )
  }
}
