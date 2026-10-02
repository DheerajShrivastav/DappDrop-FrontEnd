import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  verifyPaymentTransaction,
  parsePaymentInfo,
} from '@/lib/payment-verification'
import { attestAndRespond } from '@/lib/attest-response'
import { hasCompletedTaskOnChain } from '@/lib/web3-service'
import {
  requireSessionWallet,
  resolveCanonicalTask,
  walletMismatchResponse,
} from '@/lib/task-verification-auth'

/**
 * Verify payment transaction for a task
 * Similar to verifying ONCHAIN_TX or Humanity Protocol
 *
 * The participant is the SIWE session wallet (a body `userAddress` is only cross-checked), the
 * task must really be ONCHAIN_TX on-chain, and the payment must have been SENT by that wallet.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionWallet()
    if ('response' in auth) return auth.response
    const userAddress = auth.wallet

    const {
      campaignId: campaignIdRaw,
      taskIndex: taskIndexRaw,
      transactionHash: transactionHashRaw,
      userAddress: claimedAddress,
    } = await request.json()

    // One canonical spelling. Hashes are case-insensitive hex, but the "already used" check and the
    // unique constraint compare strings — "0xAB…" and "0xab…" used to count as two payments.
    const transactionHash =
      typeof transactionHashRaw === 'string' && /^0x[0-9a-fA-F]{64}$/.test(transactionHashRaw.trim())
        ? transactionHashRaw.trim().toLowerCase()
        : null

    const mismatch = walletMismatchResponse(claimedAddress, userAddress)
    if (mismatch) return mismatch

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
      !transactionHash
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid parameters (campaignId, taskIndex, transactionHash)' },
        { status: 400 }
      )
    }

    // Only an ONCHAIN_TX task can be completed by a payment. Without this, payment metadata on any
    // task index (e.g. a Discord task) would turn a payment into an attestation for that task.
    const canonical = await resolveCanonicalTask(campaignId, taskIndex)
    if (!canonical.ok) {
      return NextResponse.json({ verified: false, error: canonical.message }, { status: canonical.status })
    }
    if (canonical.type !== 'ONCHAIN_TX') {
      return NextResponse.json(
        { verified: false, error: 'This task is not a payment task.' },
        { status: 400 },
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
      // Cached PASS in our DB does not guarantee the on-chain completion ever landed — the
      // first attestation may have been signed but never submitted (backend down) AND never
      // self-submitted by the client. Only skip re-attesting if the chain agrees it's done;
      // otherwise fall through and attest again so the client gets a signature to submit.
      const alreadyOnChain = await hasCompletedTaskOnChain(
        campaignId,
        userAddress.toLowerCase(),
        taskIndex,
      )
      if (alreadyOnChain) {
        console.log('✅ Payment already verified and recorded on-chain')
        return NextResponse.json({
          success: true,
          verified: true,
          message: 'Payment already verified',
          transactionHash: existing.transactionHash,
        })
      }
      console.log('ℹ️ Payment verified in cache but not yet recorded on-chain — re-attesting')
      const attestResponse = await attestAndRespond(campaignId, taskIndex, userAddress, {
        taskType: 'ONCHAIN_TX',
        platform: 'onchain',
        paymentTxHash: existing.transactionHash,
        source: 'cache-hit-reattest',
        checkedAt: new Date().toISOString(),
      })
      const attestBody = await attestResponse.json()
      return NextResponse.json(
        { ...attestBody, paymentTransactionHash: existing.transactionHash },
        { status: attestResponse.status },
      )
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
      paymentInfo.network,
      userAddress, // the payment must come FROM the signed-in wallet
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

    // ONCHAIN_TX PASS → sign (and best-effort submit) the EIP-712 attestation, returning the
    // signature for self-submit fallback (BR-V3). The txHash proof stays in the response too.
    const attestResponse = await attestAndRespond(campaignId, taskIndex, userAddress, {
      taskType: 'ONCHAIN_TX',
      platform: 'onchain',
      paymentTxHash: transactionHash,
      checkedAt: new Date().toISOString(),
    })
    // Preserve the payment proof alongside the attestation fields for the client.
    const attestBody = await attestResponse.json()
    return NextResponse.json(
      { ...attestBody, paymentTransactionHash: transactionHash },
      { status: attestResponse.status },
    )
  } catch (error) {
    console.error('❌ Payment verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
