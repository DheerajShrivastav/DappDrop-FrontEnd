/**
 * Webhook dispatcher — the standalone worker that drains the WebhookDelivery queue and POSTs
 * each signed body to its host endpoint with retries (PRD BR-N*). A STANDALONE Node entrypoint,
 * NOT a Next.js route: the app only ENQUEUES (src/lib/notifications.ts); this process delivers.
 * Same `tsx` + one-shot/--loop shape as worker/keeper.ts and worker/relayer.ts. No keys, no
 * fund movement, contracts untouched.
 *
 * The one subtle invariant: a retry resends the EXACT bytes and the EXACT signature/timestamp
 * computed once at enqueue time. This worker NEVER re-signs (it never even sees the per-host
 * secret) — re-signing on retry with a fresh timestamp would break a host's replay-window check
 * and change the body a host may have already partially processed. The stable event id lets a
 * host dedupe redeliveries.
 *
 * Retry policy (per PRD):
 *   2xx                              -> DELIVERED (terminal success)
 *   4xx except 408 / 429             -> FAILED (terminal — a rejected payload is not retried forever)
 *   408 / 429 / 5xx / timeout / network -> RETRYING with capped exponential backoff, then FAILED
 *                                        once maxAttempts is exhausted
 *
 * Modes (same code, matching keeper/relayer):
 *   npm run webhooks            — one-shot: drain the currently-ready deliveries and exit (cron)
 *   npm run webhooks:loop       — always-on: drain, then poll every WEBHOOK_INTERVAL_SECONDS
 *   npm run webhooks:dry-run    — list ready deliveries WITHOUT sending anything
 *
 * Config (env, server-side only):
 *   WEBHOOK_BATCH_SIZE            deliveries processed per tick (default 20)
 *   WEBHOOK_TIMEOUT_MS           per-request timeout before a delivery is treated as failed (default 10000)
 *   WEBHOOK_BACKOFF_BASE_SECONDS base of the exponential backoff (default 30 => 30s, 60s, 120s, …)
 *   WEBHOOK_BACKOFF_MAX_SECONDS  cap on any single backoff interval (default 3600 = 1h)
 *   WEBHOOK_INTERVAL_SECONDS     poll interval for --loop (default 15)
 *   WEBHOOK_RESPONSE_SNIPPET_MAX chars of the response body kept in the redelivery log (default 500)
 */
import 'dotenv/config'

import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  EVENT_ID_HEADER,
  formatSignatureHeader,
} from '@/lib/webhook-signing'
import { prisma } from '@/lib/prisma'

const BATCH_SIZE = Number(process.env.WEBHOOK_BATCH_SIZE || '20')
const TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS || '10000')
const BACKOFF_BASE_SECONDS = Number(process.env.WEBHOOK_BACKOFF_BASE_SECONDS || '30')
const BACKOFF_MAX_SECONDS = Number(process.env.WEBHOOK_BACKOFF_MAX_SECONDS || '3600')
const INTERVAL_SECONDS = Number(process.env.WEBHOOK_INTERVAL_SECONDS || '15')
const RESPONSE_SNIPPET_MAX = Number(process.env.WEBHOOK_RESPONSE_SNIPPET_MAX || '500')

/** Backoff for the NEXT attempt (1-indexed attempt that just failed): base * 2^(attempt-1), capped. */
function backoffSeconds(attempt: number): number {
  const raw = BACKOFF_BASE_SECONDS * Math.pow(2, Math.max(0, attempt - 1))
  return Math.min(raw, BACKOFF_MAX_SECONDS)
}

/** 4xx that are NOT terminal — the host is asking us to retry, not rejecting the payload. */
function isRetryableStatus(status: number): boolean {
  if (status >= 500) return true
  if (status === 408 || status === 429) return true
  return false
}

type DeliveryRow = {
  id: string
  eventId: string
  eventType: string
  url: string
  body: string
  signature: string
  signedAt: bigint
  attempt: number
  maxAttempts: number
}

export type DeliveryOutcome =
  | { outcome: 'delivered'; statusCode: number }
  | { outcome: 'retrying'; statusCode: number | null; nextRetryAt: Date; reason: string }
  | { outcome: 'failed'; statusCode: number | null; reason: string }
  | { outcome: 'skipped'; reason: string }

/**
 * Send one delivery. Claims it atomically (ready -> DELIVERING) so two dispatcher instances
 * never double-send the same row, POSTs the stored body with the stored signature (never
 * re-signed), and records the outcome + a bounded response snippet in the redelivery log.
 */
export async function processDelivery(deliveryId: string): Promise<DeliveryOutcome> {
  // Atomic claim: only one worker can move a ready row into DELIVERING.
  const claimed = await prisma.webhookDelivery.updateMany({
    where: {
      id: deliveryId,
      status: { in: ['PENDING', 'RETRYING'] },
    },
    data: { status: 'DELIVERING', attempt: { increment: 1 } },
  })
  if (claimed.count === 0) {
    return { outcome: 'skipped', reason: 'already claimed by another instance or not ready' }
  }

  const d = (await prisma.webhookDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
  })) as unknown as DeliveryRow

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let statusCode: number | null = null
  let snippet: string | null = null
  let networkError: string | null = null

  try {
    const res = await fetch(d.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [EVENT_ID_HEADER]: d.eventId,
        [TIMESTAMP_HEADER]: d.signedAt.toString(),
        // Byte-identical to the first attempt — same timestamp, same signature.
        [SIGNATURE_HEADER]: formatSignatureHeader(d.signedAt, d.signature),
      },
      body: d.body,
      signal: controller.signal,
    })
    statusCode = res.status
    try {
      const text = await res.text()
      snippet = text.slice(0, RESPONSE_SNIPPET_MAX)
    } catch {
      snippet = null
    }
  } catch (e: unknown) {
    networkError = (e as Error)?.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : (e as Error)?.message || 'network error'
  } finally {
    clearTimeout(timer)
  }

  // 2xx — delivered.
  if (statusCode !== null && statusCode >= 200 && statusCode < 300) {
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: {
        status: 'DELIVERED',
        lastStatusCode: statusCode,
        lastResponseSnippet: snippet,
        lastError: null,
        nextRetryAt: null,
        deliveredAt: new Date(),
      },
    })
    return { outcome: 'delivered', statusCode }
  }

  // Terminal 4xx (rejected payload) — do not retry.
  if (statusCode !== null && !isRetryableStatus(statusCode)) {
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: {
        status: 'FAILED',
        lastStatusCode: statusCode,
        lastResponseSnippet: snippet,
        lastError: `terminal ${statusCode} (payload rejected — not retried)`,
        nextRetryAt: null,
      },
    })
    return { outcome: 'failed', statusCode, reason: `terminal ${statusCode}` }
  }

  // Retryable (5xx/408/429/timeout/network) — back off, unless attempts are exhausted.
  const reason = networkError ?? `retryable status ${statusCode}`
  if (d.attempt >= d.maxAttempts) {
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: {
        status: 'FAILED',
        lastStatusCode: statusCode,
        lastResponseSnippet: snippet,
        lastError: `${reason} — exhausted ${d.maxAttempts} attempts`,
        nextRetryAt: null,
      },
    })
    return { outcome: 'failed', statusCode, reason: `${reason} (exhausted)` }
  }

  const nextRetryAt = new Date(Date.now() + backoffSeconds(d.attempt) * 1000)
  await prisma.webhookDelivery.update({
    where: { id: d.id },
    data: {
      status: 'RETRYING',
      lastStatusCode: statusCode,
      lastResponseSnippet: snippet,
      lastError: reason,
      nextRetryAt,
    },
  })
  return { outcome: 'retrying', statusCode, nextRetryAt, reason }
}

/** Ready = PENDING (never tried) or RETRYING whose backoff has elapsed. */
async function findReadyDeliveries(limit: number): Promise<{ id: string }[]> {
  const now = new Date()
  return prisma.webhookDelivery.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'RETRYING', nextRetryAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })
}

export async function runDispatchTick(): Promise<void> {
  const ready = await findReadyDeliveries(BATCH_SIZE)
  console.log(`[webhooks] tick start — ${ready.length} ready delivery(ies)`)
  for (const { id } of ready) {
    const result = await processDelivery(id)
    switch (result.outcome) {
      case 'delivered':
        console.log(`[webhooks] ✅ ${id} delivered (${result.statusCode})`)
        break
      case 'retrying':
        console.log(
          `[webhooks] ↻ ${id} ${result.reason} — retrying at ${result.nextRetryAt.toISOString()}`,
        )
        break
      case 'failed':
        console.error(`[webhooks] ❌ ${id} failed: ${result.reason}`)
        break
      case 'skipped':
        console.log(`[webhooks] ⏭  ${id} ${result.reason}`)
        break
    }
  }
  console.log('[webhooks] tick complete')
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isLoop = args.includes('--loop')

  if (isDryRun) {
    const ready = await findReadyDeliveries(BATCH_SIZE)
    const rows = await prisma.webhookDelivery.findMany({
      where: { id: { in: ready.map((r) => r.id) } },
      select: { id: true, eventType: true, url: true, attempt: true, maxAttempts: true, status: true },
    })
    console.log(`[webhooks] DRY RUN — ${rows.length} ready delivery(ies):`)
    for (const r of rows) {
      console.log(`  - ${r.id} ${r.eventType} -> ${r.url} (attempt ${r.attempt}/${r.maxAttempts}, ${r.status})`)
    }
    console.log('[webhooks] dry run complete — nothing sent')
    return
  }

  if (!isLoop) {
    await runDispatchTick()
    return
  }

  console.log(`[webhooks] starting polling loop — interval ${INTERVAL_SECONDS}s`)
  let tickInProgress = false
  const tick = async () => {
    if (tickInProgress) {
      console.warn('[webhooks] previous tick still running — skipping this cycle')
      return
    }
    tickInProgress = true
    try {
      await runDispatchTick()
    } catch (e) {
      console.error('[webhooks] tick error:', e)
    } finally {
      tickInProgress = false
    }
  }
  await tick()
  setInterval(tick, INTERVAL_SECONDS * 1000)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[webhooks] fatal error:', e)
    process.exit(1)
  })
}
