// src/app/api/verify-task/route.ts
import { NextResponse } from 'next/server'
import {
  verifyDiscordJoin,
  verifyTelegramJoin,
} from '@/lib/verification-service'
import { isUserVerified } from '@/lib/humanity-service'
import { prisma } from '@/lib/prisma'
import { getCampaignById } from '@/lib/web3-service'
import type { Campaign } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      taskType,
      taskType,
      campaignId: campaignIdRaw,
      taskId,
      userAddress,
      discordUsername,
      discordId,
      telegramUsername,
      telegramUserId,
    } = body

    // Normalize to numbers
    const campaignId =
      typeof campaignIdRaw === 'number'
        ? campaignIdRaw
        : parseInt(campaignIdRaw, 10)
    const campaignId =
      typeof campaignIdRaw === 'number'
        ? campaignIdRaw
        : parseInt(campaignIdRaw, 10)
    const taskIndex = parseInt(taskId, 10)

    if (isNaN(campaignId) || isNaN(taskIndex)) {
      return NextResponse.json(
        { error: 'Invalid campaignId or taskId' },
        { status: 400 }
      )
    }

    let isVerified = false

    // Get task metadata for Discord/Telegram
    const taskMetadata = await prisma.campaignTaskMetadata.findUnique({
      where: {
        campaignId_taskIndex: {
          campaignId,
          taskIndex,
        },
      },
    })

    if (!taskType) {
      return NextResponse.json(
        { error: 'taskType is required in the request body' },
        { status: 400 }
      )
    }

    if (!taskType) {
      return NextResponse.json(
        { error: 'taskType is required in the request body' },
        { status: 400 }
      )
    }

    // Simple task type detection without heavy validation
    const isDiscordTask = taskType === 'JOIN_DISCORD'
    const isTelegramTask = taskType === 'JOIN_TELEGRAM'

    if (isDiscordTask) {
      // Discord verification - use stored server ID from dedicated column
      const discordServerId = taskMetadata?.discordServerId

      if (!discordServerId) {
        return NextResponse.json({
          success: false,
          verified: false,
          message: 'Discord server ID not found for this task',
          internalError: true,
        })
      }
      // Discord verification - use stored server ID from dedicated column
      const discordServerId = taskMetadata?.discordServerId

      if (!discordServerId) {
        return NextResponse.json({
          success: false,
          verified: false,
          message: 'Discord server ID not found for this task',
          internalError: true,
        })
      }

      isVerified = await verifyDiscordJoin(
        discordUsername,
        discordUsername,
        discordServerId,
        discordId
      )

      // Store verification if successful
      if (isVerified && userAddress) {
        const existingVerification = await prisma.socialVerification.findFirst({
          where: {
            userAddress: userAddress,
            taskId: `${campaignId}-${taskId}`,
            platform: 'DISCORD',
            isValid: true,
          },
        })

        if (!existingVerification) {
          await prisma.socialVerification.create({
            data: {
              userAddress: userAddress,
              taskId: `${campaignId}-${taskId}`,
              platform: 'DISCORD',
              proofData: {
                username: discordUsername,
                discordId: discordId || 'manual_verification',
                serverId: discordServerId,
                verificationMethod: discordId ? 'oauth' : 'manual',
                verificationTime: new Date().toISOString(),
              },
              verifiedAt: new Date(),
              isValid: true,
            },
          })
        }
      }
    } else if (isTelegramTask) {
      // Basic Telegram verification
      const telegramChatId = taskMetadata?.telegramChatId
      if (!telegramChatId) {
        console.warn('Telegram task missing chat ID metadata', {
          campaignId,
          taskIndex,
        })
        return NextResponse.json({
          success: false,
          verified: false,
          message: 'Telegram chat ID is not configured for this task',
          internalError: true,
        })
      }

      isVerified = await verifyTelegramJoin(
        telegramUsername || '',
        telegramChatId,
        telegramUserId
      )

      // Store verification if successful
      if (isVerified && userAddress) {
        const existingVerification = await prisma.socialVerification.findFirst({
          where: {
            userAddress: userAddress,
            taskId: `${campaignId}-${taskId}`,
            platform: 'TELEGRAM',
            isValid: true,
          },
        })

        if (!existingVerification) {
          await prisma.socialVerification.create({
            data: {
              userAddress: userAddress,
              taskId: `${campaignId}-${taskId}`,
              platform: 'TELEGRAM',
              proofData: {
                username: telegramUsername,
                userId: telegramUserId || 'username_verification',
                chatId: telegramChatId,
                verificationMethod: telegramUserId ? 'user_id' : 'username',
                verificationTime: new Date().toISOString(),
              },
              verifiedAt: new Date(),
              isValid: true,
            },
          })
        }
      }
    } else {
      // For HUMANITY_VERIFICATION and other tasks, get canonical task type from campaign data
      // Get the campaign to determine the actual task type
      let canonicalTaskType: string | null = null
      let requiresHumanityVerification = false

      try {
        const campaign = await getCampaignById(campaignId.toString())
        if (campaign && campaign.tasks && campaign.tasks[taskIndex]) {
          canonicalTaskType = campaign.tasks[taskIndex].type
          requiresHumanityVerification =
            canonicalTaskType === 'HUMANITY_VERIFICATION'
        }
      } catch (error) {
        console.error(
          'Error fetching campaign for task type validation:',
          error
        )
      }

      // Use metadata as override only if canonical type is available
      const effectiveTaskType = canonicalTaskType || taskMetadata?.taskType

      console.log('Task type validation:', {
        taskIndex,
        canonicalTaskType,
        metadataTaskType: taskMetadata?.taskType,
        effectiveTaskType,
        requiresHumanityVerification,
      })

      if (effectiveTaskType === 'HUMANITY_VERIFICATION' && userAddress) {
        // In v2, verification happens via OAuth flow on the client.
        // Here we just check the cached DB status (set by the OAuth callback).
        try {
          const isHuman = await isUserVerified(userAddress)
          isVerified = isHuman

          return NextResponse.json({
            success: true,
            verified: isVerified,
            message: isVerified
              ? 'Humanity verification successful'
              : 'Not verified. Please complete Humanity Protocol verification first.',
            verificationDetails: {
              taskType: effectiveTaskType,
              walletAddress: userAddress,
              isHuman,
            },
          })
        } catch (error: any) {
          console.error('Error checking humanity verification:', error)
          return NextResponse.json(
            {
              success: false,
              verified: false,
              message: 'Error checking verification status',
              error: error.message || 'Database error',
            },
            { status: 500 },
          )
        }
      } else if (
        effectiveTaskType === 'HUMANITY_VERIFICATION' &&
        !userAddress
      ) {
        // HUMANITY_VERIFICATION requires a wallet address - fail closed
        return NextResponse.json({
          success: false,
          verified: false,
          message: 'Wallet address required for humanity verification',
          internalError: false,
        })
      } else if (requiresHumanityVerification && !effectiveTaskType) {
        // Canonical task requires humanity verification but metadata is missing/misconfigured - fail closed
        console.warn(
          'Missing task type metadata for humanity verification task:',
          {
            campaignId,
            taskIndex,
            canonicalTaskType,
            metadataTaskType: taskMetadata?.taskType,
          }
        )
        return NextResponse.json({
          success: false,
          verified: false,
          message:
            'Task configuration error - humanity verification required but not properly configured',
          internalError: true,
        })
      } else {
        // For non-humanity verification tasks, default to verified only if we have a valid task type
        if (
          effectiveTaskType &&
          effectiveTaskType !== 'HUMANITY_VERIFICATION'
        ) {
          isVerified = true
        } else {
          // Unknown task type - fail closed for security
          console.warn('Unknown or missing task type - failing closed:', {
            campaignId,
            taskIndex,
            canonicalTaskType,
            metadataTaskType: taskMetadata?.taskType,
          })
          return NextResponse.json({
            success: false,
            verified: false,
            message: 'Unknown task type - verification failed',
            internalError: true,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      verified: isVerified,
      message: isVerified
        ? 'Task verified successfully'
        : 'Task verification failed',
    })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    )
  }
}
