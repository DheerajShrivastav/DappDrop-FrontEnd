import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPaymentTransaction, parsePaymentInfo } from '@/lib/payment-verification'

/**
 * Verify payment transaction for a task
 * Similar to verifying ONCHAIN_TX or Humanity Protocol
 */
export async function POST(request: NextRequest) {
  try {
    const { campaignId, taskIndex, transactionHash, userAddress } = await request.json()

    console.log('🔍 Payment verification request:', {
      campaignId,
      taskIndex,
      transactionHash,
      userAddress,
    })

    // Validate inputs
    if (!campaignId || taskIndex === undefined || !transactionHash || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Check if already verified
    const existing = await prisma.paymentVerification.findUnique({
      where: {
        campaignId_taskIndex_userAddress: {
          campaignId: campaignId.toString(),
          taskIndex: parseInt(taskIndex),
          userAddress: userAddress.toLowerCase(),
        },
      },
    })

    if (existing?.verified) {
      console.log('✅ Payment already verified')
      return NextResponse.json({
        verified: true,
        message: 'Payment already verified',
        transactionHash: existing.transactionHash,
      })
    }

    // Check for replay attack (transaction hash already used)
    const usedTx = await prisma.paymentVerification.findUnique({
      where: { transactionHash },
    })

    if (usedTx && usedTx.verified) {
      console.error('❌ Transaction hash already used for another payment')
      return NextResponse.json(
        { error: 'Transaction hash already used' },
        { status: 403 }
      )
    }

    // Get task metadata (contains payment requirements)
    const metadata = await prisma.campaignTaskMetadata.findUnique({
      where: {
        campaignId_taskIndex: {
          campaignId: campaignId.toString(),
          taskIndex: parseInt(taskIndex),
        },
      },
    })

    if (!metadata) {
      return NextResponse.json(
        { error: 'Task metadata not found' },
        { status: 404 }
      )
    }

    // Parse payment info from metadata
    const paymentInfo = parsePaymentInfo(metadata.metadata)

    if (!paymentInfo) {
      return NextResponse.json(
        { error: 'Task does not require payment' },
        { status: 400 }
      )
    }

    console.log('💰 Payment requirements:', {
      recipient: paymentInfo.paymentRecipient,
      amount: paymentInfo.amountDisplay,
      token: paymentInfo.tokenSymbol,
      network: paymentInfo.network,
    })

    // Verify the blockchain transaction
    const verification = await verifyPaymentTransaction(
      transactionHash,
      paymentInfo.paymentRecipient,
      paymentInfo.amount,
      paymentInfo.tokenAddress,
      paymentInfo.network
    )

    if (!verification.verified) {
      console.error('❌ Payment verification failed:', verification.error)
      return NextResponse.json(
        { verified: false, error: verification.error },
        { status: 400 }
      )
    }

    // Cache the verification result
    await prisma.paymentVerification.upsert({
      where: {
        campaignId_taskIndex_userAddress: {
          campaignId: campaignId.toString(),
          taskIndex: parseInt(taskIndex),
          userAddress: userAddress.toLowerCase(),
        },
      },
      create: {
        campaignId: campaignId.toString(),
        taskIndex: parseInt(taskIndex),
        userAddress: userAddress.toLowerCase(),
        transactionHash,
        verified: true,
        verifiedAt: new Date(),
      },
      update: {
        transactionHash,
        verified: true,
        verifiedAt: new Date(),
      },
    })

    console.log('✅ Payment verified and cached')

    return NextResponse.json({
      verified: true,
      message: 'Payment verified successfully',
      transactionHash,
    })
  } catch (error) {
    console.error('❌ Payment verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
