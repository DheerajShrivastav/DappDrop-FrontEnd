import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { checkCampaignHost, hostCheckUnavailableResponse } from '@/lib/require-host'
import { getPublishedAllocation } from '@/lib/allocation'
import { getPublishedNFTAllocation } from '@/lib/nft-allocation'
import {
  submitDisputeReport,
  listReportsForRoot,
  listReportsForCampaign,
  getReportForWallet,
  computeEscalation,
  DisputeReportError,
  DISPUTE_REPORT_CATEGORIES,
} from '@/lib/dispute-reports'

type PublishedTree = NonNullable<Awaited<ReturnType<typeof getPublishedAllocation>>> | NonNullable<Awaited<ReturnType<typeof getPublishedNFTAllocation>>>

/** The currently-published tree (ERC20 first, then NFT) — resolved ONCE per request and passed
 * around, since each of these triggers live on-chain reads. */
async function resolvePublishedTree(campaignId: number): Promise<PublishedTree | null> {
  const erc20 = await getPublishedAllocation(campaignId)
  if (erc20) return erc20
  return await getPublishedNFTAllocation(campaignId)
}

/**
 * GET /api/campaigns/:campaignId/reports (P4 Part 3/4) — SIWE-gated:
 *   - The campaign HOST gets every report for the CURRENTLY published root (with each
 *     reporter's own allocation inlined) plus escalation info, AND a separate list of reports
 *     filed against EARLIER roots. Reports are pinned to the root they were filed against, so
 *     without that second list a republish would make every prior report permanently
 *     unreachable — including ones the new root never actually addressed.
 *   - Anyone else gets only THEIR OWN report for the live root (if any) — "you already
 *     reported this" state for the report form, never other wallets' reports.
 */
export async function GET(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId: campaignIdRaw } = await params
  const campaignId = parseInt(campaignIdRaw, 10)
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
  }

  const hostCheck = await checkCampaignHost(campaignId, verifyWalletSession)
  if (hostCheck.kind === 'unavailable') return hostCheckUnavailableResponse(hostCheck)
  if (hostCheck.kind === 'unauthenticated') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tree = await resolvePublishedTree(campaignId)
  const merkleRoot = tree?.root ?? null

  if (hostCheck.kind === 'host') {
    const [currentReports, allReports] = await Promise.all([
      merkleRoot ? listReportsForRoot(campaignId, merkleRoot) : Promise.resolve([]),
      listReportsForCampaign(campaignId),
    ])
    const allocatedWalletCount = tree?.entries.length ?? 0
    const escalation = merkleRoot
      ? await computeEscalation(campaignId, merkleRoot, allocatedWalletCount)
      : { escalated: false, openCount: 0, share: 0 }
    const entryByWallet = new Map((tree?.entries ?? []).map((e) => [e.wallet, e]))

    const serialize = (r: (typeof allReports)[number]) => ({
      id: r.id,
      reporterWallet: r.reporterWallet,
      merkleRoot: r.merkleRoot,
      category: r.category,
      reason: r.reason,
      status: r.status,
      hostResponse: r.hostResponse,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      // The reporter's own allocation under the CURRENT root, so the host can check the claim
      // immediately without cross-referencing the table separately. Null for a prior-root
      // report whose reporter isn't in the current allocation at all.
      allocation: entryByWallet.get(r.reporterWallet)
        ? {
            amount: entryByWallet.get(r.reporterWallet)!.amount,
            tasksCompleted: entryByWallet.get(r.reporterWallet)!.tasksCompleted,
          }
        : null,
    })

    return NextResponse.json({
      merkleRoot,
      reports: currentReports.map(serialize),
      // Filed against a root that is no longer live (i.e. the host has since republished).
      priorRootReports: allReports.filter((r) => r.merkleRoot !== merkleRoot).map(serialize),
      escalation,
    })
  }

  if (!merkleRoot) {
    return NextResponse.json({ merkleRoot: null, reports: [], myReport: null })
  }
  const { walletAddress } = await verifyWalletSession()
  const mine = await getReportForWallet(campaignId, merkleRoot, walletAddress)
  return NextResponse.json({ merkleRoot, reports: [], myReport: mine })
}

/**
 * POST /api/campaigns/:campaignId/reports — file or update a "report a concern" (P4 Part 3).
 * SIWE-gated (reporterWallet always comes from the session, never the body). The root is
 * resolved server-side against the CURRENTLY PUBLISHED on-chain root and pinned to the report —
 * never taken from the client — so a later republish can't silently re-target an old report.
 */
export async function POST(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId: campaignIdRaw } = await params
  const campaignId = parseInt(campaignIdRaw, 10)
  if (isNaN(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
  }

  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tree = await resolvePublishedTree(campaignId)
  if (!tree) {
    return NextResponse.json(
      { error: 'This campaign has no published allocation to report a concern about.' },
      { status: 400 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const category = typeof body?.category === 'string' ? body.category : ''
  const reason = typeof body?.reason === 'string' ? body.reason : ''

  try {
    const report = await submitDisputeReport({
      campaignId,
      reporterWallet: walletAddress,
      merkleRoot: tree.root,
      category,
      reason,
    })
    return NextResponse.json({ success: true, report })
  } catch (e: any) {
    if (e instanceof DisputeReportError) {
      return NextResponse.json({ error: e.message, validCategories: DISPUTE_REPORT_CATEGORIES }, { status: 400 })
    }
    console.error('[reports] submit failed:', e)
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }
}
