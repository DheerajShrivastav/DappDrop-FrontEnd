import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  verifyPaymentTransaction,
  parsePaymentInfo,
} from '@/lib/payment-verification'

/**
 * Verify payment transaction for a task
 * Similar to verifying ONCHAIN_TX or Humanity Protocol
 */
export async function POST(request: NextRequest) {
  try {
    const { campaignId: campaignIdRaw, taskIndex: taskIndexRaw, transactionHash, userAddress } =
      await request.json()

    // Normalize to numbers
    const campaignId = typeof campaignIdRaw === 'number' ? campaignIdRaw : parseInt(campaignIdRaw, 10)
    const taskIndex = typeof taskIndexRaw === 'number' ? taskIndexRaw : parseInt(taskIndexRaw, 10)

    console.log('🔍 Payment verification request:', {
      campaignId,
      taskIndex,
      transactionHash,
      userAddress,
    })

    // Validate inputs
    if (
      !campaignId ||
      isNaN(campaignId) ||
      taskIndex === undefined ||
      isNaN(taskIndex) ||
      !transactionHash ||
      !userAddress
    ) {
      return NextResponse.json(
        { error: 'Missing required parameters or invalid campaignId/taskIndex' },
        { status: 400 }
      )
    }

    // Check if already verified
    const existing = await prisma.paymentVerification.findUnique({
      where: {
        campaignId_taskIndex_userAddress: {
          campaignId,
          taskIndex,
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
          campaignId,
          taskIndex,
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
          campaignId,
          taskIndex,
          userAddress: userAddress.toLowerCase(),
        },
      },
      create: {
        campaignId,
        taskIndex,
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
