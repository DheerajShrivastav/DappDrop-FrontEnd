// src/app/api/campaign-task-metadata/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionWallet } from '@/lib/task-verification-auth'
import { HostCheckUnavailableError, requireCampaignHost } from '@/lib/require-host'

/**
 * POST — write a task's off-chain verification config. HOST-ONLY.
 *
 * This decides what verify-task checks against: the Discord server, the Telegram chat, and the
 * payment recipient/amount. It used to accept writes from anyone, so a participant could point a
 * campaign's Discord task at their own server (or its payment at themselves, for 1 wei), "pass"
 * it, and get the signer to attest. Now only the campaign's on-chain host can write it.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSessionWallet()
    if ('response' in auth) return auth.response

    const body = await request.json()

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

    try {
      await requireCampaignHost(campaignId, auth.wallet)
    } catch (e) {
      if (e instanceof HostCheckUnavailableError) {
        return NextResponse.json({ error: e.message }, { status: 503 })
      }
      return NextResponse.json(
        { error: "Only this campaign's host can change its task settings." },
        { status: 403 },
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
        metadata: metadata && typeof metadata === 'object' ? metadata : null,
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
