// src/app/api/campaign-task-metadata/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  console.log('🌐 === CAMPAIGN TASK METADATA API CALLED ===')

  try {
    const body = await request.json()
    console.log('📥 Received request body:', JSON.stringify(body, null, 2))

    const {
      campaignId: campaignIdRaw,
      taskIndex: taskIndexRaw,
      taskType,
      discordInviteLink,
      telegramInviteLink,
      telegramChatId,
      requiresHumanityVerification,
      metadata,
    } = body

    // Normalize campaignId and taskIndex to numbers (they might come as strings or numbers)
    const campaignId = typeof campaignIdRaw === 'number' ? campaignIdRaw : parseInt(campaignIdRaw, 10)
    const taskIndex = typeof taskIndexRaw === 'number' ? taskIndexRaw : parseInt(taskIndexRaw, 10)

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

    if (!campaignId || isNaN(campaignId) || taskIndex === undefined || isNaN(taskIndex) || !taskType) {
      return NextResponse.json(
        { error: 'Missing required parameters or invalid campaignId/taskIndex' },
        { status: 400 }
      )
    }

    // Upsert (create or update) the task metadata
    const data = await prisma.campaignTaskMetadata.upsert({
      where: {
        campaignId_taskIndex: {
          campaignId,
          taskIndex,
        },
      },
      update: {
        taskType,
        discordInviteLink,
        discordServerId: body.discordServerId || null,
        telegramInviteLink,
        telegramChatId,
        requiresHumanityVerification: requiresHumanityVerification || false,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      },
      create: {
        campaignId,
        taskIndex,
        taskType,
        discordInviteLink,
        discordServerId: body.discordServerId || null,
        telegramInviteLink,
        telegramChatId,
        requiresHumanityVerification: requiresHumanityVerification || false,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
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
    const campaignIdParam = searchParams.get('campaignId')

    if (!campaignIdParam) {
      return NextResponse.json(
        { error: 'campaignId is required' },
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

    // Get all task metadata for a campaign
    const taskMetadata = await prisma.campaignTaskMetadata.findMany({
      where: {
        campaignId,
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
