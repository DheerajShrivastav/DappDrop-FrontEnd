// src/app/api/verify-task/route.ts
import { NextResponse } from 'next/server'
import {
  verifyDiscordJoin,
  verifyTelegramJoin,
} from '@/lib/verification-service'
import { prisma } from '@/lib/prisma'

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
      const telegramChatId = taskMetadata?.telegramChatId || ''

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
      // For HUMANITY_VERIFICATION and other tasks, determine task type
      const taskType = taskMetadata?.taskType || 'OTHER'

      if (taskType === 'HUMANITY_VERIFICATION' && userAddress) {
        try {
          // First check cached verification status
          const humanityResponse = await fetch(
            `${
              process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
            }/api/verify-humanity?walletAddress=${userAddress}`
          )

          if (humanityResponse.ok) {
            const humanityData = await humanityResponse.json()
            isVerified = humanityData.success && humanityData.isHuman

            // If not verified in cache, trigger verification
            if (!isVerified) {
              const verifyResponse = await fetch(
                `${
                  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
                }/api/verify-humanity`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ walletAddress: userAddress }),
                }
              )

              if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json()
                isVerified = verifyData.success && verifyData.isHuman
              }
            }
          }
        } catch (error) {
          console.error('Humanity verification error:', error)
          isVerified = false
        }
      } else if (taskType === 'HUMANITY_VERIFICATION' && !userAddress) {
        // HUMANITY_VERIFICATION requires a wallet address
        isVerified = false
      } else {
        // Default to verified for any other task types when no specific verification is needed
        isVerified = true
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
