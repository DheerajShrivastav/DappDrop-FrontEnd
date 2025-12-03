// src/app/api/campaign-task-metadata/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  console.log('🌐 === CAMPAIGN TASK METADATA API CALLED ===')

  try {
    const body = await request.json()
    console.log('📥 Received request body:', JSON.stringify(body, null, 2))

    const {
      campaignId,
      taskIndex,
      taskType,
      discordInviteLink,
      telegramInviteLink,
      telegramChatId,
      requiresHumanityVerification,
      metadata,
    } = body

    console.log('📝 Extracted fields:', {
      campaignId,
      taskIndex,
      taskType,
      discordInviteLink,
      telegramInviteLink,
      telegramChatId,
      requiresHumanityVerification,
      metadata,
    })

    if (!campaignId || taskIndex === undefined || !taskType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Upsert (create or update) the task metadata
    const data = await prisma.campaignTaskMetadata.upsert({
      where: {
        campaignId_taskIndex: {
          campaignId: campaignId,
          taskIndex: parseInt(taskIndex),
        },
      },
      update: {
        taskType,
        discordInviteLink,
        telegramInviteLink,
        telegramChatId,
        requiresHumanityVerification: requiresHumanityVerification || false,
        metadata,
      },
      create: {
        campaignId: campaignId.toString(),
        taskIndex: parseInt(taskIndex.toString()),
        taskType,
        discordInviteLink,
        telegramInviteLink,
        telegramChatId,
        requiresHumanityVerification: requiresHumanityVerification || false,
        metadata,
      },
    })

    console.log('✅ Successfully stored task metadata:', data.id)
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('❌ Error managing task metadata:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId is required' },
        { status: 400 }
      )
    }

    // Get all task metadata for a campaign
    const taskMetadata = await prisma.campaignTaskMetadata.findMany({
      where: {
        campaignId: campaignId.toString(),
      },
      orderBy: {
        taskIndex: 'asc',
      },
    })

    return NextResponse.json({ success: true, data: taskMetadata })
  } catch (error) {
    console.error('Error fetching task metadata:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
