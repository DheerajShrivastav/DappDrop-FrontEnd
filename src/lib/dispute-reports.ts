import 'server-only'

import { prisma } from './prisma'
import { notifyDisputeReportFiled, notifyDisputeReportReviewed } from './notifications'
import { getCampaignHostOnChain } from './require-host'

/**
 * "Report a concern" (P4 Part 3) — deliberately scoped small. A report is a signal to the host
 * and the platform team during the 24h dispute window; it can NEVER stop or delay claims
 * (claiming is on-chain and checks only the Merkle proof + timer — the backend has no
 * per-campaign pause). The only real correction path is the host publishing a different root,
 * which restarts the window (see the warning copy required on that flow).
 */

export const DISPUTE_REPORT_CATEGORIES = [
  'missing_allocation',
  'wrong_amount',
  'sybil_suspected',
  'other',
] as const
export type DisputeReportCategory = (typeof DISPUTE_REPORT_CATEGORIES)[number]

export const DISPUTE_REASON_MAX_LENGTH = 2000

// Volume escalation thresholds (config-driven, alert-only — never automated action).
const ESCALATION_OPEN_COUNT_THRESHOLD = Number(process.env.DISPUTE_ESCALATION_OPEN_COUNT || '5')
const ESCALATION_SHARE_THRESHOLD = Number(process.env.DISPUTE_ESCALATION_SHARE || '0.1') // 10%

export class DisputeReportError extends Error {}

/** Submit or update a wallet's report against a specific (pinned) root. One row per
 * (campaignId, merkleRoot, reporterWallet) — a repeat submit updates the existing report and
 * reopens it if it had been reviewed/resolved, rather than creating a duplicate. */
export async function submitDisputeReport(params: {
  campaignId: number
  reporterWallet: string
  merkleRoot: string
  category: string
  reason: string
}) {
  if (!DISPUTE_REPORT_CATEGORIES.includes(params.category as DisputeReportCategory)) {
    throw new DisputeReportError(`Invalid category. Must be one of: ${DISPUTE_REPORT_CATEGORIES.join(', ')}`)
  }
  const reason = params.reason.trim()
  if (!reason) {
    throw new DisputeReportError('A reason is required.')
  }
  if (reason.length > DISPUTE_REASON_MAX_LENGTH) {
    throw new DisputeReportError(`Reason must be ${DISPUTE_REASON_MAX_LENGTH} characters or fewer.`)
  }

  const reporterWallet = params.reporterWallet.toLowerCase()
  const report = await prisma.disputeReport.upsert({
    where: {
      campaignId_merkleRoot_reporterWallet: {
        campaignId: params.campaignId,
        merkleRoot: params.merkleRoot,
        reporterWallet,
      },
    },
    create: {
      campaignId: params.campaignId,
      reporterWallet,
      merkleRoot: params.merkleRoot,
      category: params.category,
      reason,
      status: 'OPEN',
    },
    update: {
      category: params.category,
      reason,
      // A repeat submit reopens the report so the host looks again, rather than silently
      // editing a resolved one underneath them. It deliberately does NOT clear hostResponse /
      // reviewedAt: the host's reply is a historical fact addressed to this reporter, and the
      // dialog pre-fills category+reason from the existing report — so a reporter who opens it
      // just to re-read their own report and hits "Update" would otherwise destroy the reply
      // they were coming back to read.
      status: 'OPEN',
    },
  })

  // Best-effort notification (BR-N*) — never allowed to fail the report submission itself. The
  // recipient is the ON-CHAIN host (BR-I4), not CampaignCache.hostAddress — that field is a
  // display-only sync copy that can drift stale, and a notification misrouted to a stale host
  // is worse than one that's merely late.
  try {
    const [hostAddress, cache] = await Promise.all([
      getCampaignHostOnChain(params.campaignId),
      prisma.campaignCache.findFirst({ where: { campaignId: params.campaignId } }),
    ])
    const openCount = await countOpenReports(params.campaignId, params.merkleRoot)
    await notifyDisputeReportFiled({
      campaignId: params.campaignId,
      hostAddress,
      campaignName: cache?.title,
      reporterWallet,
      category: params.category,
      openReportCount: openCount,
    })
  } catch (e) {
    console.warn('[dispute-reports] notification failed (non-fatal):', e)
  }

  return report
}

export async function countOpenReports(campaignId: number, merkleRoot: string): Promise<number> {
  return prisma.disputeReport.count({ where: { campaignId, merkleRoot, status: 'OPEN' } })
}

/** All reports (any status) for the given root — host review panel. */
export async function listReportsForRoot(campaignId: number, merkleRoot: string) {
  return prisma.disputeReport.findMany({
    where: { campaignId, merkleRoot },
    orderBy: { createdAt: 'desc' },
  })
}

/** Every report for a campaign, across ALL roots. Reports are pinned to the root they were
 * filed against, so once a host republishes, root-scoped queries alone would make every prior
 * report permanently unreachable — including ones the new root never actually addressed. */
export async function listReportsForCampaign(campaignId: number) {
  return prisma.disputeReport.findMany({
    where: { campaignId },
    orderBy: { createdAt: 'desc' },
  })
}

/** A wallet's own report for a root, if any — so the report form can show "you already
 * reported this" instead of a blank form. */
export async function getReportForWallet(campaignId: number, merkleRoot: string, wallet: string) {
  return prisma.disputeReport.findUnique({
    where: {
      campaignId_merkleRoot_reporterWallet: {
        campaignId,
        merkleRoot,
        reporterWallet: wallet.toLowerCase(),
      },
    },
  })
}

export async function markReportReviewed(reportId: string, hostResponse: string | null) {
  const reviewedAt = new Date()
  const report = await prisma.disputeReport.update({
    where: { id: reportId },
    data: { status: 'REVIEWED', hostResponse, reviewedAt },
  })

  // Best-effort notification (BR-N*) — never allowed to fail the review itself. Without this the
  // host's reply is write-only: it is addressed to the reporter, but nothing would ever tell
  // them it exists. In-app to the reporter only; no webhook, since webhooks here are host-facing
  // and the host is the one who just wrote the response.
  try {
    const cache = await prisma.campaignCache.findFirst({ where: { campaignId: report.campaignId } })
    await notifyDisputeReportReviewed({
      campaignId: report.campaignId,
      reporterWallet: report.reporterWallet,
      reportId: report.id,
      reviewedAt,
      campaignName: cache?.title,
      hostResponse: report.hostResponse,
    })
  } catch (e) {
    console.warn('[dispute-reports] reviewed notification failed (non-fatal):', e)
  }

  return report
}

/**
 * Volume escalation (alert only, never automated action): whether OPEN reports for this root
 * cross the configured count threshold, or cover a meaningful share of allocated wallets.
 */
export async function computeEscalation(
  campaignId: number,
  merkleRoot: string,
  allocatedWalletCount: number,
): Promise<{ escalated: boolean; openCount: number; share: number }> {
  const openCount = await countOpenReports(campaignId, merkleRoot)
  const share = allocatedWalletCount > 0 ? openCount / allocatedWalletCount : 0
  return {
    escalated: openCount >= ESCALATION_OPEN_COUNT_THRESHOLD || share >= ESCALATION_SHARE_THRESHOLD,
    openCount,
    share,
  }
}

/** All campaigns with at least one OPEN report — admin console visibility (P3 CP4 extension). */
export async function listCampaignsWithOpenReports() {
  const grouped = await prisma.disputeReport.groupBy({
    by: ['campaignId', 'merkleRoot'],
    where: { status: 'OPEN' },
    _count: { _all: true },
  })
  return grouped
    .map((g) => ({ campaignId: g.campaignId, merkleRoot: g.merkleRoot, openCount: g._count._all }))
    .sort((a, b) => b.openCount - a.openCount)
}
