// src/app/api/verify-task/route.ts
import { NextResponse } from 'next/server'
import { getCampaignById } from '@/lib/web3-service'
import { verifyDiscordJoin } from '@/lib/verification-service'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { campaignId, taskId, userAddress, discordUsername, discordId } = body

    if (!campaignId || !taskId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const campaign = await getCampaignById(campaignId)
    const taskIndex = parseInt(taskId, 10)
    const task = campaign?.tasks[taskIndex]

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    let isVerified = false

    if (task.type === 'JOIN_DISCORD') {
      const discordServerId = task.verificationData
      if (!discordServerId) {
        return NextResponse.json(
          { error: 'Discord Server ID not configured for this task.' },
          { status: 500 }
        )
      }
      if (!discordUsername) {
        return NextResponse.json(
          { error: 'Discord username is required for verification.' },
          { status: 400 }
        )
      }

      // Use both Discord ID and username for verification if available
      isVerified = await verifyDiscordJoin(
        discordUsername,
        discordServerId,
        discordId
      )

      if (isVerified) {
        // Check if verification already exists for this user, campaign, and task
        const existingVerification = await prisma.socialVerification.findFirst({
          where: {
            userAddress: userAddress,
            taskId: `${campaignId}-${taskId}`,
            platform: 'DISCORD',
            isValid: true,
          },
        })

        // Only create new verification if none exists
        if (!existingVerification) {
          await prisma.socialVerification.create({
            data: {
              userAddress: userAddress,
              taskId: `${campaignId}-${taskId}`, // Create a unique ID for the task instance
              platform: 'DISCORD',
              proofData: {
                username: discordUsername,
                discordId: discordId || 'manual_verification_required',
                serverId: discordServerId,
                verificationMethod: discordId ? 'oauth' : 'manual',
                verificationTime: new Date().toISOString(),
              },
              verifiedAt: new Date(),
              isValid: true,
            },
          })
          console.log('Created new verification record for:', {
            userAddress,
            campaignId,
            taskId,
            discordUsername,
          })
        } else {
          console.log('Verification already exists for:', {
            userAddress,
            campaignId,
            taskId,
            existingId: existingVerification.id,
          })
        }
      }
    } else {
      // For other task types that might need backend verification in the future
      isVerified = true
    }

    if (isVerified) {
      // Verification successful - let the frontend handle the smart contract call
      // since it has access to the user's wallet
      return NextResponse.json({
        success: true,
        verified: true,
        message: 'Task verified successfully. Ready for blockchain completion.',
      })
    } else {
      return NextResponse.json(
        { success: false, verified: false, error: 'Task verification failed.' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('API Error:', error)
    // Check for Prisma-specific errors if necessary
    return NextResponse.json(
      { error: error.message || 'An unknown error occurred' },
      { status: 500 }
    )
  }
}
