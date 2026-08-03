// src/app/api/sponsored-claims/route.ts
//
// Thin enqueue endpoint (PRD BR-R*). This route does NOT process claims or touch the relayer
// key — it only validates the request, runs the gating checks for immediate UI feedback, and
// writes a SponsoredClaim row. worker/relayer.ts (a separate standalone process) is what
// actually pre-simulates and sends transactions. Self-claim (claimERC20 from the user's own
// wallet) never goes through this endpoint and is never gated by anything here.
import { NextResponse } from 'next/server'
import { enqueueSponsoredClaim, getSponsoredClaimStatus, RelayerError } from '@/lib/relayer'
import { isValidEthereumAddress } from '@/lib/validation-utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { campaignId: campaignIdRaw, account } = body

    const campaignId =
      typeof campaignIdRaw === 'number' ? campaignIdRaw : parseInt(campaignIdRaw, 10)
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
    }
    if (typeof account !== 'string' || !isValidEthereumAddress(account)) {
      return NextResponse.json({ error: 'Invalid account address' }, { status: 400 })
    }

    const result = await enqueueSponsoredClaim(campaignId, account)

    if (result.status === 'DECLINED') {
      // Not an HTTP error — a valid request the platform has chosen not to pay gas for.
      // The UI routes the user to self-claim, which remains available regardless.
      return NextResponse.json(
        { status: 'DECLINED', reason: result.reason, selfClaimAvailable: true },
        { status: 200 },
      )
    }
    return NextResponse.json({ status: result.status, id: result.id }, { status: 202 })
  } catch (error: any) {
    if (error instanceof RelayerError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Error enqueueing sponsored claim:', error)
    return NextResponse.json({ error: 'Failed to enqueue sponsored claim' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignIdRaw = searchParams.get('campaignId')
    const account = searchParams.get('account')

    const campaignId = campaignIdRaw ? parseInt(campaignIdRaw, 10) : NaN
    if (isNaN(campaignId) || !account || !isValidEthereumAddress(account)) {
      return NextResponse.json({ error: 'campaignId and account query params are required' }, { status: 400 })
    }

    const claim = await getSponsoredClaimStatus(campaignId, account)
    if (!claim) {
      return NextResponse.json({ status: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({
      status: claim.status,
      declineReason: claim.declineReason,
      txHash: claim.txHash,
      lastError: claim.status === 'FAILED' ? claim.lastError : undefined,
    })
  } catch (error: any) {
    console.error('Error reading sponsored claim status:', error)
    return NextResponse.json({ error: 'Failed to read sponsored claim status' }, { status: 500 })
  }
}
