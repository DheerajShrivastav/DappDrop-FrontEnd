import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { postProofCode } from '@/lib/x-proof'

/** GET ?campaignId= — the signed-in wallet's proof-by-post code for that campaign. */
export async function GET(request: Request) {
  let wallet: string
  try {
    wallet = (await verifyWalletSession()).walletAddress
  } catch {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  const campaignId = Number(new URL(request.url).searchParams.get('campaignId'))
  if (!Number.isInteger(campaignId) || campaignId < 1) return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
  return NextResponse.json({ code: postProofCode(campaignId, wallet) }, { headers: { 'Cache-Control': 'no-store' } })
}
