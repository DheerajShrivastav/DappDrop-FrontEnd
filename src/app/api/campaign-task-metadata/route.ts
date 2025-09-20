// src/app/api/campaign-task-metadata/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { campaignId, taskIndex, taskType, discordInviteLink, metadata } =
      body

    if (!campaignId || taskIndex === undefined || !taskType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Upsert (create or update) the task metadata
    const taskMetadata = await prisma.campaignTaskMetadata.upsert({
      where: {
        campaignId_taskIndex: {
          campaignId: campaignId.toString(),
          taskIndex: parseInt(taskIndex, 10),
        },
      },
      update: {
        taskType,
        discordInviteLink: discordInviteLink || null,
        metadata: metadata || null,
      },
      create: {
        campaignId: campaignId.toString(),
        taskIndex: parseInt(taskIndex, 10),
        taskType,
        discordInviteLink: discordInviteLink || null,
        metadata: metadata || null,
      },
    })

    return NextResponse.json({ success: true, data: taskMetadata })
  } catch (error) {
    console.error('Error managing task metadata:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
