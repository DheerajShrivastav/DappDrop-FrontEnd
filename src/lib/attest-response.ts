import 'server-only'

import { NextResponse } from 'next/server'
import {
  attestTaskCompletion,
  SignerConcurrentRequestError,
  SignerNotConfiguredError,
  SignerRateLimitedError,
  SignerRejectedError,
  type AttestationEvidence,
} from './signer'

/**
 * Shared bridge from a verifier PASS to a signed (and best-effort submitted) EIP-712
 * attestation, shaped as an HTTP response (BR-V2/V3). Used by every verifier route so the
 * sign→submit→self-submit-fallback behaviour is identical everywhere. Replaces the removed
 * client-side completeTask recording for attested tasks (gap-analysis §3).
 *
 * The returned `attestation.signature` lets the client self-submit if the backend didn't;
 * it is never logged server-side.
 */
export async function attestAndRespond(
  campaignId: number,
  taskIndex: number,
  participant: string | undefined,
  evidence: AttestationEvidence,
): Promise<NextResponse> {
  if (!participant) {
    return NextResponse.json(
      { success: false, verified: false, message: 'Wallet address is required' },
      { status: 400 },
    )
  }
  try {
    const att = await attestTaskCompletion({
      campaignId,
      taskIndex,
      participant,
      completed: true,
      evidence,
    })
    return NextResponse.json({
      success: true,
      verified: true,
      attested: true,
      submitted: att.submitted,
      txHash: att.txHash,
      attestation: {
        campaignId: att.campaignId,
        taskIndex: att.taskIndex,
        participant: att.participant,
        completed: att.completed,
        deadline: att.deadline,
        signature: att.signature,
      },
      message: att.submitted
        ? 'Task verified and recorded on-chain.'
        : 'Task verified. Submit the attestation from your wallet to record it.',
    })
  } catch (e) {
    if (e instanceof SignerRejectedError) {
      return NextResponse.json(
        { success: false, verified: false, message: e.message },
        { status: 400 },
      )
    }
    if (e instanceof SignerRateLimitedError) {
      return NextResponse.json(
        { success: false, verified: false, message: e.message },
        { status: 429 },
      )
    }
    if (e instanceof SignerConcurrentRequestError) {
      return NextResponse.json(
        { success: false, verified: false, message: e.message },
        { status: 409 },
      )
    }
    if (e instanceof SignerNotConfiguredError) {
      return NextResponse.json(
        {
          success: false,
          verified: true, // the CHECK passed; only the signing service is unavailable
          message:
            'Verified, but the attestation service is temporarily unavailable. Please try again shortly.',
        },
        { status: 503 },
      )
    }
    console.error('[attest] error:', (e as Error)?.message)
    return NextResponse.json(
      { success: false, verified: false, message: 'Attestation failed' },
      { status: 500 },
    )
  }
}
