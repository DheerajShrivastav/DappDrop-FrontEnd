import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireCampaignHost } from '@/lib/require-host'
import { getCampaignByIdWithMetadata } from '@/lib/web3-service'
import { getCampaignFunnelAnalytics } from '@/lib/campaign-funnel'

/** Quote a CSV field only if it needs it (contains a comma, quote, or newline). */
function csvField(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * GET /api/campaigns/:campaignId/analytics/export/funnel — CSV export of the funnel + per-task
 * completion/failure breakdown (P3 CP3). Host-only.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
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
  try {
    await requireCampaignHost(campaignId, walletAddress)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  const campaign = await getCampaignByIdWithMetadata(String(campaignId))
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const analytics = await getCampaignFunnelAnalytics(campaign)

  const lines: string[] = []
  lines.push('section,key,value')
  lines.push(`funnel,joined,${analytics.funnel.joined}`)
  lines.push(`funnel,tasksStarted,${analytics.funnel.tasksStarted}`)
  lines.push(`funnel,qualified,${analytics.funnel.qualified}`)
  lines.push(`funnel,claimed,${analytics.funnel.claimed}`)
  lines.push(`humanity,gated,${analytics.humanityGated}`)
  lines.push(`humanity,excluded,${analytics.humanityExcluded}`)
  lines.push(`claimSplit,sponsored,${analytics.claimSplit.sponsored}`)
  lines.push(`claimSplit,self,${analytics.claimSplit.self}`)
  lines.push('')
  lines.push('taskIndex,taskType,completedCount,participantCount,completionRate,failureReason,failureCount')
  for (const t of analytics.taskStats) {
    if (t.failures.length === 0) {
      lines.push(
        [t.taskIndex, csvField(t.taskType), t.completedCount, t.participantCount, t.completionRate.toFixed(3), '', ''].join(','),
      )
    } else {
      for (const f of t.failures) {
        lines.push(
          [
            t.taskIndex,
            csvField(t.taskType),
            t.completedCount,
            t.participantCount,
            t.completionRate.toFixed(3),
            csvField(f.reason),
            f.count,
          ].join(','),
        )
      }
    }
  }
  lines.push('')
  lines.push('claimDate,claimCount')
  for (const b of analytics.claimsOverTime) {
    lines.push(`${b.date},${b.count}`)
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="campaign-${campaignId}-funnel.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
