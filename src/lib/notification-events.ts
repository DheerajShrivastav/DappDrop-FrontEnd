/**
 * Notification event catalog (PRD BR-N*). Pure constants + types — no Prisma, no 'server-only' —
 * so the app, the dispatcher worker, and tests share ONE definition of every event key and its
 * stable id. Emission itself lives in src/lib/notifications.ts.
 *
 * Each event is sourced from a REAL lifecycle/indexed trigger (campaign-lifecycle.ts state
 * transitions, the keeper's endCampaign, the allocation publish, the relayer's confirmed claim,
 * …), never re-derived ad hoc. Events wired to a live trigger in this phase are marked ✅; the
 * rest are defined here (so the catalog is complete and the dispatch path is ready) with their
 * call site flagged as a follow-up pending the indexer/keeper maturing enough to fire them.
 */

export const NotificationEventType = {
  // ── Participant-facing ──
  TASK_VERIFIED: 'task.verified', // (follow-up: wire from /api/verify-task result)
  CAMPAIGN_ENDED: 'campaign.ended', // (follow-up: wire from keeper endCampaign)
  ALLOCATIONS_PUBLISHED: 'allocations.published', // ✅ wired (markAllocationPublished) — "claims open in 24h"
  CLAIMS_OPEN: 'claims.open', // (follow-up: fire when dispute window elapses — needs a scheduled check)
  SPONSORED_CLAIM_CONFIRMED: 'sponsored_claim.confirmed', // ✅ wired (worker/relayer confirmed)
  GRACE_EXPIRY_WARNING: 'grace.expiry_warning', // (follow-up: 7d/48h-before-sweep scheduled check)
  DISPUTE_REPORT_REVIEWED: 'dispute_report.reviewed', // ✅ wired (markReportReviewed, P4) — host replied to your report

  // ── Host-facing ──
  HOST_CAMPAIGN_OPENED: 'host.campaign.opened', // (follow-up)
  HOST_CAMPAIGN_ENDED: 'host.campaign.ended', // (follow-up: wire from keeper)
  HOST_PARTICIPANT_CAP_REACHED: 'host.participant_cap.reached', // (follow-up: indexer MaxParticipants signal)
  HOST_FUNDING_RECEIPT: 'host.funding.receipt', // (follow-up: indexer CampaignFundedERC20)
  HOST_ALLOCATION_PROPOSAL_READY: 'host.allocation.proposal_ready', // ✅ wired (proposeAllocation)
  HOST_DISPUTE_WINDOW_STARTED: 'host.dispute_window.started', // ✅ wired (markAllocationPublished)
  HOST_DISPUTE_WINDOW_ELAPSED: 'host.dispute_window.elapsed', // (follow-up: scheduled check)
  HOST_CLAIM_RATE_MILESTONE: 'host.claim_rate.milestone', // (follow-up: indexer claim aggregation)
  HOST_SWEEP_AVAILABLE: 'host.sweep.available', // (follow-up: scheduled check at closedAt+30d)
  HOST_DISPUTE_REPORT_FILED: 'host.dispute_report.filed', // ✅ wired (submitDisputeReport, P4)
} as const

export type NotificationEventType =
  (typeof NotificationEventType)[keyof typeof NotificationEventType]

/**
 * Stable, deterministic event id — the SAME logical event always produces the SAME id, so a
 * re-emit is idempotent (the (recipient, eventId) / (endpointId, eventId) unique constraints
 * dedupe it) and a webhook redelivery carries the id the host already saw. Keep the discriminator
 * specific enough that genuinely distinct events never collide (e.g. include the milestone bucket
 * or the warning threshold), but identical across retries of the same event.
 */
export function makeEventId(
  type: NotificationEventType,
  campaignId: number | string,
  discriminator?: string | number,
): string {
  const base = `${type}:${campaignId}`
  return discriminator === undefined ? base : `${base}:${discriminator}`
}

/** Payload shapes for the wired events (others carry a free-form Record until wired). */
export type EventPayloads = {
  [NotificationEventType.ALLOCATIONS_PUBLISHED]: {
    campaignId: number
    campaignName?: string
    amount?: string
    token?: string
    claimsOpenAt?: string // ISO
  }
  [NotificationEventType.SPONSORED_CLAIM_CONFIRMED]: {
    campaignId: number
    txHash: string
    amount?: string
    token?: string
  }
  [NotificationEventType.HOST_ALLOCATION_PROPOSAL_READY]: {
    campaignId: number
    campaignName?: string
    walletCount: number
    excludedCount: number
  }
  [NotificationEventType.HOST_DISPUTE_WINDOW_STARTED]: {
    campaignId: number
    campaignName?: string
    claimsOpenAt?: string // ISO
  }
  [NotificationEventType.DISPUTE_REPORT_REVIEWED]: {
    campaignId: number
    campaignName?: string
    reportId: string
    // The host's written reply. Carried here so it reaches the reporter in the notification
    // itself, not only when they reopen the report dialog. Null/absent when the host marked the
    // report reviewed without writing anything.
    hostResponse?: string | null
  }
  [NotificationEventType.HOST_DISPUTE_REPORT_FILED]: {
    campaignId: number
    campaignName?: string
    reporterWallet: string
    category: string
    openReportCount: number
  }
}
