import { NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { getEntrypointReadContract } from '@/lib/web3-service'
import { isValidEthereumAddress } from '@/lib/validation-utils'

/**
 * POST /api/admin/moderation/flag — records the DB-side mirror of an on-chain flagAccount tx
 * (P3 CP4). flagAccount() itself is signed by the connected moderator's OWN wallet client-side
 * (src/lib/web3-service.ts:flagAccountOnChain) — this route never signs anything. It exists
 * because User.moderationFlagged/moderationReason (already read by relayer-gates.ts to block
 * sponsored claims) had nothing writing to them; the on-chain AccountFlagged event is the source
 * of truth, so this route re-verifies the given txHash against a real receipt + decoded event
 * before trusting the client's claim, rather than taking userAddress/score/reason on faith.
 */
export async function POST(request: Request) {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    await requireAdminRole(walletAddress, 'MODERATOR')
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { userAddress, reason, txHash } = body as { userAddress?: string; reason?: string; txHash?: string }

  if (!userAddress || !isValidEthereumAddress(userAddress)) {
    return NextResponse.json({ error: 'Valid userAddress is required' }, { status: 400 })
  }
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json({ error: 'Valid txHash is required' }, { status: 400 })
  }

  const c = getEntrypointReadContract()
  const provider = c.runner as ethers.Provider
  const receipt = await provider.getTransactionReceipt(txHash)
  if (!receipt || receipt.status !== 1) {
    return NextResponse.json({ error: 'Transaction not found or not successful' }, { status: 400 })
  }
  if ((receipt.to || '').toLowerCase() !== (await c.getAddress()).toLowerCase()) {
    return NextResponse.json({ error: 'Transaction was not sent to the campaign contract' }, { status: 400 })
  }

  const flaggedLog = receipt.logs
    .map((log) => {
      try {
        return c.interface.parseLog(log)
      } catch {
        return null
      }
    })
    .find((parsed) => parsed?.name === 'AccountFlagged')

  if (!flaggedLog) {
    return NextResponse.json({ error: 'Transaction did not emit AccountFlagged' }, { status: 400 })
  }

  const eventUser = (flaggedLog.args?.user as string) ?? ''
  const eventScore = Number(flaggedLog.args?.score ?? 0)
  if (eventUser.toLowerCase() !== userAddress.toLowerCase()) {
    return NextResponse.json({ error: 'txHash flags a different address than userAddress' }, { status: 400 })
  }

  const lowerUser = userAddress.toLowerCase()
  const user = await prisma.user.upsert({
    where: { walletAddress: lowerUser },
    create: {
      walletAddress: lowerUser,
      moderationFlagged: eventScore > 0,
      moderationReason: eventScore > 0 ? reason || null : null,
    },
    update: {
      moderationFlagged: eventScore > 0,
      moderationReason: eventScore > 0 ? reason || null : null,
    },
  })

  return NextResponse.json({
    success: true,
    userAddress: lowerUser,
    score: eventScore,
    moderationFlagged: user.moderationFlagged,
    moderationReason: user.moderationReason,
  })
}
