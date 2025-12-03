import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parsePaymentInfo } from '@/lib/payment-verification'

/**
 * Check if a user has completed a payment task
 * Similar to checking Humanity Protocol verification status
 */
export async function GET(request: NextRequest) {
  try {
    const campaignId = request.nextUrl.searchParams.get('campaignId')
    const taskIndex = request.nextUrl.searchParams.get('taskIndex')
    const userAddress = request.nextUrl.searchParams.get('userAddress')

    if (!campaignId || !taskIndex || !userAddress) {
      return NextResponse.json(
        {
          error:
            'Missing required parameters: campaignId, taskIndex, userAddress',
        },
        { status: 400 }
      )
    }

    console.log('🔍 Checking payment status:', {
      campaignId,
      taskIndex,
      userAddress,
    })

    // Get task metadata
    const metadata = await prisma.campaignTaskMetadata.findUnique({
      where: {
        campaignId_taskIndex: {
          campaignId,
          taskIndex: parseInt(taskIndex),
        },
      },
    })

    if (!metadata) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const paymentInfo = parsePaymentInfo(metadata.metadata)

    // Check verification status
    const verification = await prisma.paymentVerification.findUnique({
      where: {
        campaignId_taskIndex_userAddress: {
          campaignId,
          taskIndex: parseInt(taskIndex),
          userAddress: userAddress.toLowerCase(),
        },
      },
    })

    const response = {
      verified: verification?.verified || false,
      transactionHash: verification?.transactionHash || null,
      verifiedAt: verification?.verifiedAt || null,
      paymentRequired: paymentInfo?.paymentRequired || false,
      paymentInfo: paymentInfo
        ? {
            recipient: paymentInfo.paymentRecipient,
            amount: paymentInfo.amountDisplay,
            token: paymentInfo.tokenSymbol,
            network: paymentInfo.network,
            chainId: paymentInfo.chainId,
          }
        : null,
    }

    console.log('📊 Payment status:', response)

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Error checking payment status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
