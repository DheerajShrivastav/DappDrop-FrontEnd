import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parsePaymentInfo } from '@/lib/payment-verification'
import { requireSessionWallet, walletMismatchResponse } from '@/lib/task-verification-auth'

/**
 * Check if the signed-in wallet has completed a payment task
 * Similar to checking Humanity Protocol verification status
 *
 * Session-only: it used to answer for any `userAddress`, linking a wallet to its payment tx for
 * anyone who asked. The query param is now optional and only cross-checked.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionWallet()
    if ('response' in auth) return auth.response
    const userAddress = auth.wallet

    const campaignIdParam = request.nextUrl.searchParams.get('campaignId')
    const taskIndexParam = request.nextUrl.searchParams.get('taskIndex')
    const mismatch = walletMismatchResponse(request.nextUrl.searchParams.get('userAddress'), userAddress)
    if (mismatch) return mismatch

    if (!campaignIdParam || !taskIndexParam) {
      return NextResponse.json(
        {
          error:
            'Missing required parameters: campaignId, taskIndex',
        },
        { status: 400 }
      )
    }

    const campaignId = parseInt(campaignIdParam, 10)
    const taskIndex = parseInt(taskIndexParam, 10)

    if (isNaN(campaignId) || isNaN(taskIndex)) {
      return NextResponse.json(
        { error: 'campaignId and taskIndex must be valid numbers' },
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
          taskIndex,
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
          taskIndex,
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
