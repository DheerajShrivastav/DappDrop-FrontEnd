import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { verifyWalletSession } from '@/app/lib/dal'
import { prisma } from '@/lib/prisma'
import { checkCampaignHost, hostCheckUnavailableResponse } from '@/lib/require-host'

const MAX_ADDRESSES = 500

/**
 * GET ?addresses=0x..,0x.. — participants' self-entered X handles, for THIS campaign's host only,
 * so they can spot-check self-reported tasks. The handles are unverified (labelled so in the UI).
 */
export async function GET(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId: raw } = await params
  const campaignId = Number(raw)
  if (!Number.isInteger(campaignId) || campaignId < 1) return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })

  const check = await checkCampaignHost(campaignId, verifyWalletSession)
  if (check.kind === 'unavailable') return hostCheckUnavailableResponse(check)
  if (check.kind === 'unauthenticated') return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (check.kind !== 'host') return NextResponse.json({ error: "Only this campaign's host can see participants' X handles." }, { status: 403 })

  const addresses = (new URL(request.url).searchParams.get('addresses') ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter((a) => isAddress(a))
    .slice(0, MAX_ADDRESSES)
  if (addresses.length === 0) return NextResponse.json({ handles: {} })

  const rows = await prisma.user.findMany({
    where: { walletAddress: { in: addresses }, xHandle: { not: null } },
    select: { walletAddress: true, xHandle: true },
  })
  const handles = Object.fromEntries(rows.map((r) => [r.walletAddress.toLowerCase(), r.xHandle]))
  return NextResponse.json({ handles }, { headers: { 'Cache-Control': 'no-store' } })
}
