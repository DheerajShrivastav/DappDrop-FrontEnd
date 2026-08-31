// src/app/api/sponsored-claims/route.ts
//
// Thin enqueue endpoint (PRD BR-R*). This route does NOT process claims or touch the relayer
// key — it only validates the request, runs the gating checks for immediate UI feedback, and
// writes a SponsoredClaim row. worker/relayer.ts (a separate standalone process) is what
// actually pre-simulates and sends transactions. Self-claim (claimERC20 from the user's own
// wallet) never goes through this endpoint and is never gated by anything here.
//
// AUTH: the acting wallet comes from the SIWE session, never the request body. This endpoint
// spends the PLATFORM's ETH, so an unauthenticated caller could previously enqueue claims for
// every allocated wallet in a campaign and drain the per-campaign and daily gas budgets. Funds
// were never at risk — the reward always pays out to the allocated account by contract design,
// so this was griefing rather than theft — but a griefing vector that costs real money and
// denies sponsorship to genuine participants is worth closing. Self-claim is untouched and
// remains available regardless of anything here.
import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { enqueueSponsoredClaim, getSponsoredClaimStatus, RelayerError } from '@/lib/relayer'
import { isValidEthereumAddress } from '@/lib/validation-utils'

/** The SIWE session wallet, or a 401 response. The acting account is ALWAYS this — a body/query
 * `account` is only ever cross-checked against it, never trusted in its place. */
async function requireSessionWallet(): Promise<{ wallet: string } | { response: NextResponse }> {
  try {
    const { walletAddress } = await verifyWalletSession()
    return { wallet: walletAddress.toLowerCase() }
  } catch {
    return {
      response: NextResponse.json(
        { error: 'Sign in with your wallet to request a sponsored claim. You can still claim yourself.' },
        { status: 401 },
      ),
    }
  }
}

/** Reject an explicit mismatch rather than silently substituting the session wallet — a client
 * asking on behalf of a different address is a bug (or an attempt) and should hear about it. */
function mismatch(supplied: unknown, sessionWallet: string): boolean {
  return typeof supplied === 'string' && supplied.toLowerCase() !== sessionWallet
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionWallet()
    if ('response' in auth) return auth.response

    const body = await request.json()
    const { campaignId: campaignIdRaw, account: suppliedAccount } = body

    const campaignId =
      typeof campaignIdRaw === 'number' ? campaignIdRaw : parseInt(campaignIdRaw, 10)
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
    }
    if (mismatch(suppliedAccount, auth.wallet)) {
      return NextResponse.json(
        { error: 'You can only request a sponsored claim for your own wallet.' },
        { status: 403 },
      )
    }
    // Defensive: the session wallet should always be a valid address, but this endpoint spends
    // real ETH, so it never reaches the queue unvalidated.
    if (!isValidEthereumAddress(auth.wallet)) {
      return NextResponse.json({ error: 'Invalid account address' }, { status: 400 })
    }

    const result = await enqueueSponsoredClaim(campaignId, auth.wallet)

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
    const auth = await requireSessionWallet()
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(request.url)
    const campaignIdRaw = searchParams.get('campaignId')
    const suppliedAccount = searchParams.get('account')

    const campaignId = campaignIdRaw ? parseInt(campaignIdRaw, 10) : NaN
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }
    // A claim's declineReason can say why a wallet was refused sponsorship (e.g. it is
    // moderation-flagged), so status is readable only by its owner.
    if (mismatch(suppliedAccount, auth.wallet)) {
      return NextResponse.json(
        { error: 'You can only read the sponsored-claim status for your own wallet.' },
        { status: 403 },
      )
    }

    const claim = await getSponsoredClaimStatus(campaignId, auth.wallet)
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
