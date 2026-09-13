import { prisma } from './prisma'
import { computeSignature } from './webhook-signing'
import {
  NotificationEventType,
  makeEventId,
  type EventPayloads,
} from './notification-events'

/**
 * Notification emit service (PRD BR-N*). Deliberately NOT 'server-only' — the standalone
 * dispatcher worker and the relayer worker both call into the wired emitters, same as
 * relayer-gates.ts. Three channels:
 *   1. In-app  — always: one Notification row per recipient (the app reads these).
 *   2. Email   — optional, wallet-linked, opt-in; degrades to a logged no-op when no provider
 *                is configured (never a hard failure). Q7 (email scope) is still an open PRD
 *                decision — default here is "in-app + webhooks always, email only if the user
 *                has an email on file". FLAGGED.
 *   3. Webhook — HMAC-signed outbound POSTs to a host's configured endpoints. This service only
 *                ENQUEUES a signed WebhookDelivery row; worker/webhook-dispatcher.ts drains it.
 *                The signature is computed ONCE here and never recomputed on retry.
 *
 * Secrets: the per-host webhook secret is read here only to sign, never logged, never put in a
 * payload. The dispatcher never touches it.
 */

const WEBHOOK_MAX_ATTEMPTS = Number(process.env.WEBHOOK_MAX_ATTEMPTS || '6')

// ── Channel 1: in-app ──────────────────────────────────────────────────────────────────────

async function emitInApp(params: {
  recipients: string[]
  type: NotificationEventType
  title: string
  body: string
  payload: Record<string, unknown>
  eventId: string
}): Promise<number> {
  const rows = params.recipients.map((r) => ({
    recipient: r.toLowerCase(),
    type: params.type,
    title: params.title,
    body: params.body,
    payload: params.payload as object,
    eventId: params.eventId,
  }))
  if (rows.length === 0) return 0
  // skipDuplicates makes re-emit idempotent against the (recipient, eventId) unique constraint.
  const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true })
  return result.count
}

// ── Channel 2: email (optional, degrades to no-op) ──────────────────────────────────────────

/** Whether an email provider is configured. No provider on this deployment => email is a no-op. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY)
}

async function sendEmailBestEffort(params: {
  wallets: string[]
  subject: string
  body: string
}): Promise<void> {
  if (!isEmailConfigured()) {
    // Clean degrade — log + skip, never throw. (Q7 default: email only when a provider exists.)
    console.log(
      `[notifications] email skipped (no provider configured) — would have sent "${params.subject}" to ${params.wallets.length} wallet(s)`,
    )
    return
  }
  // Only wallets that have an email on file AND opted in (User.email present == opted in here;
  // a granular per-type preference is a follow-up). Look them up and send.
  const users = await prisma.user.findMany({
    where: { walletAddress: { in: params.wallets.map((w) => w.toLowerCase()) }, email: { not: null } },
    select: { email: true },
  })
  const emails = users.map((u) => u.email).filter((e): e is string => Boolean(e))
  if (emails.length === 0) return
  // Provider send would go here (Resend/SES/etc.). Intentionally not wired to a specific vendor
  // in this phase — the gate above means it's a no-op on this deployment. Flagged as follow-up.
  console.log(`[notifications] (email provider configured) would send "${params.subject}" to ${emails.length} address(es)`)
}

// ── Channel 3: webhooks (enqueue a signed delivery; worker drains) ──────────────────────────

/**
 * Enqueue one signed WebhookDelivery per active endpoint of `hostAddress`. The body is built and
 * signed ONCE here; retries in the dispatcher resend these exact bytes with this exact signature.
 */
export async function dispatchWebhooksForHost(params: {
  hostAddress: string
  eventId: string
  eventType: NotificationEventType
  payload: Record<string, unknown>
}): Promise<number> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { hostAddress: params.hostAddress.toLowerCase(), active: true },
  })
  if (endpoints.length === 0) return 0

  const signedAt = BigInt(Math.floor(Date.now() / 1000))
  const bodyObject = {
    id: params.eventId,
    type: params.eventType,
    createdAt: new Date().toISOString(),
    data: params.payload,
  }
  // Serialize ONCE — this exact string is what gets signed and resent verbatim on every retry.
  const body = JSON.stringify(bodyObject)

  let enqueued = 0
  for (const ep of endpoints) {
    const signature = computeSignature(ep.secret, signedAt, body)
    // Upsert on the (endpointId, eventId) unique key => a double-emit of the same logical event
    // is a no-op; the existing row (and its stable signature) is preserved.
    await prisma.webhookDelivery.upsert({
      where: { endpointId_eventId: { endpointId: ep.id, eventId: params.eventId } },
      create: {
        endpointId: ep.id,
        eventId: params.eventId,
        eventType: params.eventType,
        url: ep.url,
        body,
        signature,
        signedAt,
        status: 'PENDING',
        maxAttempts: WEBHOOK_MAX_ATTEMPTS,
      },
      update: {}, // idempotent — never re-sign or reset an existing delivery
    })
    enqueued++
  }
  return enqueued
}

// ── Read path (used by the API routes) ──────────────────────────────────────────────────────

export async function listNotifications(
  wallet: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
) {
  return prisma.notification.findMany({
    where: {
      recipient: wallet.toLowerCase(),
      ...(opts.unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 30, 100),
  })
}

export async function unreadCount(wallet: string): Promise<number> {
  return prisma.notification.count({
    where: { recipient: wallet.toLowerCase(), read: false },
  })
}

export async function markNotificationsRead(
  wallet: string,
  opts: { ids?: string[]; all?: boolean },
): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: {
      recipient: wallet.toLowerCase(),
      read: false,
      ...(opts.all ? {} : { id: { in: opts.ids ?? [] } }),
    },
    data: { read: true, readAt: new Date() },
  })
  return res.count
}

// ── High-level emitters for the wired lifecycle events ──────────────────────────────────────

/**
 * ✅ Fired from src/lib/allocation.ts::markAllocationPublished — a REAL lifecycle transition
 * (host published the ERC20 Merkle root). Participants get "claims open in 24h"; the host gets
 * "dispute window started" in-app + on every configured webhook.
 */
export async function notifyAllocationsPublished(params: {
  campaignId: number
  /** On-chain host (BR-I4). Optional because it is read from chain at the call site: if that read
   * fails we still owe participants their "claims open soon" notice, so the host half is skipped
   * rather than dropping the participant half with it. */
  hostAddress?: string
  allocatedWallets: string[]
  campaignName?: string
  claimsOpenAt?: Date
  amount?: string
  token?: string
}): Promise<void> {
  const claimsOpenIso = params.claimsOpenAt?.toISOString()

  const participantPayload: EventPayloads[typeof NotificationEventType.ALLOCATIONS_PUBLISHED] = {
    campaignId: params.campaignId,
    campaignName: params.campaignName,
    amount: params.amount,
    token: params.token,
    claimsOpenAt: claimsOpenIso,
  }
  const participantEventId = makeEventId(
    NotificationEventType.ALLOCATIONS_PUBLISHED,
    params.campaignId,
  )
  await emitInApp({
    recipients: params.allocatedWallets,
    type: NotificationEventType.ALLOCATIONS_PUBLISHED,
    title: 'Your rewards are almost claimable',
    body: claimsOpenIso
      ? `Allocations were published for ${params.campaignName ?? `campaign #${params.campaignId}`}. Claims open after the 24-hour review window (${new Date(claimsOpenIso).toLocaleString()}).`
      : `Allocations were published for ${params.campaignName ?? `campaign #${params.campaignId}`}. Claims open after the 24-hour review window.`,
    payload: participantPayload,
    eventId: participantEventId,
  })
  await sendEmailBestEffort({
    wallets: params.allocatedWallets,
    subject: 'Your DappDrop rewards are almost claimable',
    body: `Allocations were published for campaign #${params.campaignId}.`,
  })

  // Host side — in-app + webhooks: the dispute window has started. Skipped entirely when the
  // on-chain host could not be resolved; a misrouted host notification is worse than a missing one.
  if (!params.hostAddress) return

  const hostEventId = makeEventId(
    NotificationEventType.HOST_DISPUTE_WINDOW_STARTED,
    params.campaignId,
  )
  const hostPayload: EventPayloads[typeof NotificationEventType.HOST_DISPUTE_WINDOW_STARTED] = {
    campaignId: params.campaignId,
    campaignName: params.campaignName,
    claimsOpenAt: claimsOpenIso,
  }
  await emitInApp({
    recipients: [params.hostAddress],
    type: NotificationEventType.HOST_DISPUTE_WINDOW_STARTED,
    title: 'Dispute window started',
    body: `The 24-hour community review window for campaign #${params.campaignId} has started. Claims open once it elapses.`,
    payload: hostPayload,
    eventId: hostEventId,
  })
  await dispatchWebhooksForHost({
    hostAddress: params.hostAddress,
    eventId: hostEventId,
    eventType: NotificationEventType.HOST_DISPUTE_WINDOW_STARTED,
    payload: hostPayload,
  })
}

/**
 * ✅ Fired from worker/relayer.ts when a sponsored claim CONFIRMS on-chain. The participant gets
 * an in-app confirmation; the host gets a webhook (a sponsored claim was paid for their campaign).
 */
export async function notifySponsoredClaimConfirmed(params: {
  campaignId: number
  account: string
  txHash: string
  hostAddress?: string
  amount?: string
  token?: string
}): Promise<void> {
  const eventId = makeEventId(
    NotificationEventType.SPONSORED_CLAIM_CONFIRMED,
    params.campaignId,
    params.account.toLowerCase(),
  )
  const payload: EventPayloads[typeof NotificationEventType.SPONSORED_CLAIM_CONFIRMED] = {
    campaignId: params.campaignId,
    txHash: params.txHash,
    amount: params.amount,
    token: params.token,
  }
  await emitInApp({
    recipients: [params.account],
    type: NotificationEventType.SPONSORED_CLAIM_CONFIRMED,
    title: 'Reward claimed for you',
    body: `Your reward for campaign #${params.campaignId} was claimed on your behalf (gas sponsored). Tx ${params.txHash.slice(0, 10)}…`,
    payload,
    eventId,
  })
  if (params.hostAddress) {
    await dispatchWebhooksForHost({
      hostAddress: params.hostAddress,
      eventId,
      eventType: NotificationEventType.SPONSORED_CLAIM_CONFIRMED,
      payload: { ...payload, account: params.account.toLowerCase() },
    })
  }
}

/**
 * ✅ Fired from src/lib/allocation.ts::proposeAllocation — the host's allocation proposal is
 * ready to review. In-app + webhook to the host.
 */
export async function notifyAllocationProposalReady(params: {
  campaignId: number
  hostAddress: string
  campaignName?: string
  walletCount: number
  excludedCount: number
}): Promise<void> {
  const eventId = makeEventId(
    NotificationEventType.HOST_ALLOCATION_PROPOSAL_READY,
    params.campaignId,
    params.walletCount, // distinct per re-proposal size, so a genuinely new proposal re-notifies
  )
  const payload: EventPayloads[typeof NotificationEventType.HOST_ALLOCATION_PROPOSAL_READY] = {
    campaignId: params.campaignId,
    campaignName: params.campaignName,
    walletCount: params.walletCount,
    excludedCount: params.excludedCount,
  }
  await emitInApp({
    recipients: [params.hostAddress],
    type: NotificationEventType.HOST_ALLOCATION_PROPOSAL_READY,
    title: 'Allocation proposal ready',
    body: `A proposal for campaign #${params.campaignId} is ready to review: ${params.walletCount} wallet(s)${params.excludedCount > 0 ? `, ${params.excludedCount} excluded by humanity gating` : ''}.`,
    payload,
    eventId,
  })
  await dispatchWebhooksForHost({
    hostAddress: params.hostAddress,
    eventId,
    eventType: NotificationEventType.HOST_ALLOCATION_PROPOSAL_READY,
    payload,
  })
}

/**
 * ✅ Fired from src/lib/dispute-reports.ts::submitDisputeReport (P4) — a participant reported a
 * concern about the published allocation during the review window. In-app + webhook to the
 * host. No SLA, no automated action — this is a signal, nothing more (the host decides whether
 * to publish a corrected allocation; reporting never pauses claims).
 */
export async function notifyDisputeReportFiled(params: {
  campaignId: number
  hostAddress: string
  campaignName?: string
  reporterWallet: string
  category: string
  openReportCount: number
}): Promise<void> {
  // Discriminated by wallet + count so a genuinely new report (new reporter, or the open count
  // changing) notifies again, but re-fetching an unchanged state never spams a duplicate.
  const eventId = makeEventId(
    NotificationEventType.HOST_DISPUTE_REPORT_FILED,
    params.campaignId,
    `${params.reporterWallet.toLowerCase()}:${params.openReportCount}`,
  )
  const payload: EventPayloads[typeof NotificationEventType.HOST_DISPUTE_REPORT_FILED] = {
    campaignId: params.campaignId,
    campaignName: params.campaignName,
    reporterWallet: params.reporterWallet.toLowerCase(),
    category: params.category,
    openReportCount: params.openReportCount,
  }
  await emitInApp({
    recipients: [params.hostAddress],
    type: NotificationEventType.HOST_DISPUTE_REPORT_FILED,
    title: 'A concern was reported',
    body: `A wallet reported a concern (${params.category}) about the published allocation for ${params.campaignName ?? `campaign #${params.campaignId}`}. ${params.openReportCount} open report(s) total.`,
    payload,
    eventId,
  })
  await dispatchWebhooksForHost({
    hostAddress: params.hostAddress,
    eventId,
    eventType: NotificationEventType.HOST_DISPUTE_REPORT_FILED,
    payload,
  })
}

/**
 * ✅ Fired from src/lib/dispute-reports.ts::markReportReviewed (P4) — the host marked a report
 * REVIEWED and (optionally) attached a written response. In-app ONLY, to the reporter: without
 * this the host's response is write-only, visible only if the reporter happens to reopen the
 * report dialog. No webhook — webhooks here are host-facing, and the host is the one who wrote
 * the response.
 */
export async function notifyDisputeReportReviewed(params: {
  campaignId: number
  reporterWallet: string
  reportId: string
  reviewedAt: Date
  campaignName?: string
  hostResponse?: string | null
}): Promise<void> {
  // Discriminated by report + reviewedAt. markReportReviewed stamps a FRESH reviewedAt on every
  // review, so a host who edits their reply and re-marks the report reviewed produces a new id
  // and legitimately notifies the reporter again — while a retry of the SAME emit reuses the
  // same reviewedAt and dedupes against the (recipient, eventId) unique constraint.
  const eventId = makeEventId(
    NotificationEventType.DISPUTE_REPORT_REVIEWED,
    params.campaignId,
    `${params.reportId}:${params.reviewedAt.getTime()}`,
  )
  const payload: EventPayloads[typeof NotificationEventType.DISPUTE_REPORT_REVIEWED] = {
    campaignId: params.campaignId,
    campaignName: params.campaignName,
    reportId: params.reportId,
    hostResponse: params.hostResponse,
  }
  const response = params.hostResponse?.trim()
  const target = params.campaignName ?? `campaign #${params.campaignId}`
  await emitInApp({
    recipients: [params.reporterWallet],
    type: NotificationEventType.DISPUTE_REPORT_REVIEWED,
    title: 'The host reviewed your report',
    body: response
      ? `The host reviewed your report on ${target} and replied: “${response}”`
      : `The host reviewed your report on ${target}. They did not leave a written response.`,
    payload,
    eventId,
  })
}
