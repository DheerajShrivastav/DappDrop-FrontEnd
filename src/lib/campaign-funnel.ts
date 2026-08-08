import 'server-only'

import { prisma } from './prisma'
import {
  getCampaignParticipants,
  getClaimEvents,
  hasCompletedTaskOnChain,
  runWithConcurrencyPublic,
} from './web3-service'
import type { Campaign } from './types'

/**
 * Host analytics (P3 CP3). Read-only, no new contract surface. Sourced from direct RPC reads
 * (the subgraph is disabled — docs/DECISIONS_v0.6.0.md Decision 3 — so this is the direct-RPC
 * equivalent of "indexed data") plus the DB tables that already exist for other purposes
 * (SponsoredClaim, MerkleTree/AllocationEntry, VerificationFailure). Nothing here feeds back
 * into a value-bearing action (BR-I4 is about claim/settle paths re-verifying against RPC —
 * this is display-only), so counts are best-effort accurate, not re-verified per read.
 */

export type FunnelStage = {
  joined: number
  tasksStarted: number // completed >= 1 task
  qualified: number // completed EVERY task (same bar as the allocation pipeline)
  claimed: number // from on-chain claim events — authoritative regardless of settlement mode
}

export type TaskCompletionStat = {
  taskIndex: number
  taskType: string
  completedCount: number
  participantCount: number
  completionRate: number // 0-1
  failures: { reason: string; count: number }[]
}

export type ClaimSplit = { sponsored: number; self: number }

export type ClaimBucket = { date: string; count: number } // date = YYYY-MM-DD (UTC)

export type CampaignFunnelResult = {
  funnel: FunnelStage
  taskStats: TaskCompletionStat[]
  humanityGated: boolean
  humanityExcluded: number
  claimSplit: ClaimSplit
  claimsOverTime: ClaimBucket[]
}

export async function getCampaignFunnelAnalytics(campaign: Campaign): Promise<CampaignFunnelResult> {
  const participants = await getCampaignParticipants(campaign)
  const totalTasks = campaign.tasks.length

  const joined = participants.length
  const tasksStarted = participants.filter((p) => p.tasksCompleted > 0).length
  const qualified = participants.filter((p) => p.tasksCompleted >= totalTasks && totalTasks > 0).length

  const [claimEvents, sponsoredConfirmed, cache, failureRows] = await Promise.all([
    getClaimEvents(campaign),
    prisma.sponsoredClaim.count({ where: { campaignId: Number(campaign.id), status: 'CONFIRMED' } }),
    prisma.campaignCache.findFirst({ where: { campaignId: Number(campaign.id) } }),
    prisma.verificationFailure.groupBy({
      by: ['taskIndex', 'reason'],
      where: { campaignId: Number(campaign.id) },
      _count: { reason: true },
    }),
  ])

  const claimed = claimEvents.length
  const sponsored = Math.min(sponsoredConfirmed, claimed)
  const self = Math.max(0, claimed - sponsored)

  // Claims bucketed by UTC day.
  const bucketMap = new Map<string, number>()
  for (const e of claimEvents) {
    if (!e.timestamp) continue
    const date = new Date(e.timestamp * 1000).toISOString().slice(0, 10)
    bucketMap.set(date, (bucketMap.get(date) ?? 0) + 1)
  }
  const claimsOverTime = Array.from(bucketMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Humanity exclusion — from the latest tree (either reward kind; the field is shared).
  const humanityGated = cache?.humanityGated ?? false
  let humanityExcluded = 0
  if (humanityGated) {
    const latestTree = await prisma.merkleTree.findFirst({
      where: { campaignId: Number(campaign.id) },
      orderBy: { version: 'desc' },
    })
    humanityExcluded = latestTree?.excludedForHumanity.length ?? 0
  }

  // Per-task completion, bounded (participants x tasks — capped by the platform's own 20-task,
  // ~100k-participant limits; runs only on-demand when a host opens this view, not on every
  // page render).
  const taskStats: TaskCompletionStat[] = []
  if (totalTasks > 0 && participants.length > 0) {
    for (let taskIndex = 0; taskIndex < totalTasks; taskIndex++) {
      const results = await runWithConcurrencyPublic(
        participants.map((p) => p.address),
        3,
        (address) => hasCompletedTaskOnChain(Number(campaign.id), address, taskIndex),
      )
      const completedCount = results.filter(Boolean).length
      const failures = failureRows
        .filter((f) => f.taskIndex === taskIndex)
        .map((f) => ({ reason: f.reason, count: f._count.reason }))
      taskStats.push({
        taskIndex,
        taskType: campaign.tasks[taskIndex]?.type ?? 'UNKNOWN',
        completedCount,
        participantCount: participants.length,
        completionRate: participants.length > 0 ? completedCount / participants.length : 0,
        failures,
      })
    }
  }

  return {
    funnel: { joined, tasksStarted, qualified, claimed },
    taskStats,
    humanityGated,
    humanityExcluded,
    claimSplit: { sponsored, self },
    claimsOverTime,
  }
}

export type HostOverviewStats = {
  totalSponsoredClaims: number
  totalHumanityExcluded: number
  totalVerificationFailures: number
}

/**
 * Cheap, DB-only cross-campaign summary for the host dashboard (extends the existing
 * dashboard/page.tsx overview, doesn't duplicate it — that page already computes
 * totalCampaigns/activeCampaigns/totalParticipants from already-fetched campaign data; this
 * adds the analytics-specific aggregates that live in the DB rather than on-chain state).
 * Deliberately skips the expensive per-task RPC loop getCampaignFunnelAnalytics does (and
 * total claim COUNTS, which need the same per-campaign RPC log scan getClaimEvents does) —
 * running either for every campaign on a dashboard load would be far too slow. Only the
 * DB-native aggregates that are cheap at any campaign count are included here; the full
 * breakdown (including self- vs sponsored-claim split) is one click away on each campaign's
 * own analytics panel.
 */
export async function getHostOverviewStats(campaignIds: number[]): Promise<HostOverviewStats> {
  if (campaignIds.length === 0) {
    return { totalSponsoredClaims: 0, totalHumanityExcluded: 0, totalVerificationFailures: 0 }
  }

  const [sponsoredCount, failureCount, trees] = await Promise.all([
    prisma.sponsoredClaim.count({ where: { campaignId: { in: campaignIds }, status: 'CONFIRMED' } }),
    prisma.verificationFailure.count({ where: { campaignId: { in: campaignIds } } }),
    prisma.merkleTree.findMany({
      where: { campaignId: { in: campaignIds } },
      orderBy: { version: 'desc' },
      distinct: ['campaignId'],
      select: { excludedForHumanity: true },
    }),
  ])

  const totalHumanityExcluded = trees.reduce((sum, t) => sum + t.excludedForHumanity.length, 0)

  return {
    totalSponsoredClaims: sponsoredCount,
    totalHumanityExcluded,
    totalVerificationFailures: failureCount,
  }
}
