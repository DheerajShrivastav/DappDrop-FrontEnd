// src/app/api/verify-task/route.ts
import { NextResponse } from 'next/server'
import {
  verifyDiscordJoin,
  verifyTelegramJoin,
} from '@/lib/verification-service'
import { prisma } from '@/lib/prisma'
import { getCampaignById } from '@/lib/web3-service'
import type { Campaign } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      campaignId,
      taskId,
      userAddress,
      discordUsername,
      discordId,
      telegramUsername,
      telegramUserId,
    } = body

    const taskIndex = parseInt(taskId, 10)
    let isVerified = false

    // Get task metadata for Discord/Telegram
    const taskMetadata = await prisma.campaignTaskMetadata.findUnique({
      where: {
        campaignId_taskIndex: {
          campaignId: campaignId.toString(),
          taskIndex: taskIndex,
        },
      },
    })

    // Simple task type detection without heavy validation
    const isDiscordTask = discordUsername || discordId
    const isTelegramTask = telegramUsername || telegramUserId

    if (isDiscordTask) {
      // Basic Discord verification - use default server ID if not provided
      const discordServerId = '1234567890' // Default or from env

      isVerified = await verifyDiscordJoin(
        discordUsername || 'default',
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
        // Create request-origin-safe URL for internal API calls
        const baseUrl = new URL('/api/verify-humanity', request.url)

        try {
          console.log('Performing humanity verification for:', userAddress)

          // For task verification, we want to force a fresh check
          // This ensures users who just completed verification can immediately complete tasks
          const verifyResponse = await fetch(baseUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: userAddress,
              forceRefresh: true, // Force fresh verification for task completion
            }),
          })

          let verificationResult = {
            success: false,
            isHuman: false,
            error: null as string | null,
            internalError: false,
          }

          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json()
            console.log('Fresh verification result for task:', verifyData)

            if (verifyData.success) {
              verificationResult = {
                success: true,
                isHuman: verifyData.isHuman,
                error: verifyData.error || null,
                internalError: false,
              }
            } else {
              verificationResult = {
                success: false,
                isHuman: false,
                error: verifyData.error || 'Verification service error',
                internalError: true,
              }
            }
          } else {
            console.error(
              'Humanity verification API call failed:',
              verifyResponse.status,
              verifyResponse.statusText
            )
            verificationResult = {
              success: false,
              isHuman: false,
              error: `Verification service unavailable (${verifyResponse.status})`,
              internalError: true,
            }
          }

          isVerified = verificationResult.isHuman

          // Return detailed response for humanity verification
          return NextResponse.json({
            success: verificationResult.success,
            verified: isVerified,
            message: isVerified
              ? 'Humanity verification successful'
              : verificationResult.error || 'Humanity verification failed',
            internalError: verificationResult.internalError,
            verificationDetails: {
              taskType: effectiveTaskType,
              walletAddress: userAddress,
              isHuman: verificationResult.isHuman,
            },
          })
        } catch (error: any) {
          console.error(
            'Network/infrastructure error during humanity verification:',
            error
          )
          return NextResponse.json(
            {
              success: false,
              verified: false,
              message: 'Infrastructure error during verification',
              internalError: true,
              error: error.message || 'Network error',
            },
            { status: 500 }
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
