/**
 * Keeper — the standalone worker that calls the permissionless `endCampaign` on schedule
 * (PRD BR-K1..K4). A STANDALONE Node entrypoint, NOT a Next.js route: it shares the app's
 * lib/ (config address book, web3-service's chain helpers) but runs as its own process, via
 * `tsx` (Node's native TS stripping does NOT resolve the app's `@/*` tsconfig path aliases —
 * verified empirically; tsx does).
 *
 * LIVENESS CONVENIENCE, NOT A REQUIREMENT (BR-K2): `endCampaign` is permissionless — anyone
 * can call it once `endTime` has passed. A keeper outage delays automation; it never locks
 * funds. Hosting the always-on polling mode (see --loop below) is an ops decision (a small
 * always-on Node host, or a scheduler like cron/Vercel Cron invoking the one-shot mode on a
 * schedule instead) — nothing here assumes any particular hosting.
 *
 * Modes (same code, two CLI entry points):
 *   npm run keeper            — one-shot: process a single sweep and exit (cron/manual)
 *   npm run keeper:loop       — always-on: sweep, then poll every KEEPER_INTERVAL_MINUTES
 *   npm run keeper:dry-run    — list endable campaigns WITHOUT sending anything
 *
 * Config (env, server-side only — never NEXT_PUBLIC_):
 *   KEEPER_PRIVATE_KEY      required to send txs. A dedicated, low-value hot key that ONLY
 *                           ever calls endCampaign — never the SIGNER_ROLE or submitter key
 *                           (same key-separation principle as src/lib/signer.ts).
 *   KEEPER_INTERVAL_MINUTES polling interval for --loop (default 5).
 *   KEEPER_MAX_ATTEMPTS     retry cap per campaign per sweep (default 3).
 *   KEEPER_OVERDUE_ALERT_MINUTES  loud-alert threshold (default 30, per BR-K2).
 *   KEEPER_TX_TIMEOUT_MS    max time to wait for a submitted tx to confirm before treating
 *                           the attempt as failed and moving on (default 120000 = 2min) —
 *                           a stalled RPC or a never-mined tx must not hang the whole sweep.
 *
 * OUT OF SCOPE (deliberately): does not publish allocation roots or run the allocation
 * pipeline (BR-M3 keeps that host-gated) or touch the relayer/notification workers (P2).
 * Pre-computing an allocation PROPOSAL (not publishing) on Ended was considered as an
 * optional, off-by-default secondary function, but src/lib/allocation.ts imports
 * 'server-only', which throws unconditionally outside Next's server runtime (verified: it
 * errors immediately under tsx here, same as under plain node) — Next's webpack swaps in a
 * no-op only inside an actual Next.js build. Wiring this in would need either stripping that
 * guard from allocation.ts's import chain (out of scope for a keeper change) or having the
 * keeper call an internal API route over HTTP instead of importing the module directly.
 * Flagged as a follow-up, not attempted here.
 */
// MUST be the first import: unlike Next.js (which auto-loads .env), a standalone tsx/node
// process does NOT — every downstream import below reads process.env at module-load time
// (config.ts reads NEXT_PUBLIC_CHAIN_ID immediately), so this has to run before any of them.
import 'dotenv/config'

import { ethers } from 'ethers'
import config from '@/app/config'
import { getAllCampaigns, getEntrypointContract, getEntrypointReadContract } from '@/lib/web3-service'
import type { Campaign } from '@/lib/types'

const MAX_ATTEMPTS = Number(process.env.KEEPER_MAX_ATTEMPTS || '3')
const OVERDUE_ALERT_MS =
  Number(process.env.KEEPER_OVERDUE_ALERT_MINUTES || '30') * 60 * 1000
const RETRY_BACKOFF_MS = 2000
const GAS_BUMP_PERCENT_PER_ATTEMPT = 20 // escalating gas on retry
// A stalled RPC or an underpriced tx that never gets mined must not hang a sweep forever —
// ethers' TransactionResponse.wait(confirms, timeoutMs) natively rejects past this deadline
// instead of blocking indefinitely, so the attempt loop can move on and retry with bumped gas.
const TX_WAIT_TIMEOUT_MS = Number(process.env.KEEPER_TX_TIMEOUT_MS || '120000')

const OPEN_STATUS = 1
const ENDED_STATUS = 2

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** The keeper's own signing key (server-side config value). Separate chokepoint from the
 * signer/submitter keys in src/lib/signer.ts — this key must never hold SIGNER_ROLE. */
function loadKeeperWallet(provider: ethers.Provider): ethers.Wallet {
  const pk = process.env.KEEPER_PRIVATE_KEY
  if (!pk) {
    throw new Error(
      'KEEPER_PRIVATE_KEY is not set — the keeper needs a dedicated funded wallet to send endCampaign transactions.',
    )
  }
  return new ethers.Wallet(pk, provider)
}

export type EndableCampaign = { id: string; endDate: Date; title: string }

/**
 * Discovery (BR-K1): fast-path via the subgraph when configured, RPC fallback otherwise —
 * the same shape getAllCampaigns() already gives every other read path in the app. NOTE: the
 * decision to actually SEND a transaction is never made from this data (see
 * endCampaignSafely) — the indexer is for discovery/scheduling only (BR-I4), a stale or
 * misconfigured subgraph can only cause the keeper to under- or over-attempt a sweep, never
 * to send a transaction that shouldn't be sent (the on-chain re-check catches that).
 */
export async function findEndableCampaigns(): Promise<EndableCampaign[]> {
  const all: Campaign[] = await getAllCampaigns()
  const now = Date.now()
  return all
    .filter((c) => c.status === 'Open' && c.endDate.getTime() <= now)
    .map((c) => ({ id: c.id, endDate: c.endDate, title: c.title }))
}

export type EndResult =
  | { outcome: 'ended'; txHash: string }
  | { outcome: 'already-not-open' }
  | { outcome: 'not-yet-due' }
  | { outcome: 'failed'; error: string }

/**
 * Ends a single campaign, safely and idempotently:
 * 1. Re-reads status/endTime DIRECTLY on-chain immediately before sending (BR-I4) — never
 *    trusts the discovery source for the send decision. This is what prevents a double-end
 *    or a race against a manual/participant end.
 * 2. Sends via the keeper wallet, with escalating gas on retry (capped at MAX_ATTEMPTS).
 * 3. Verifies SUCCESS by re-reading state after confirmation (status must be Ended), not
 *    just that the tx was accepted (BR-K1).
 * 4. Idempotent: if the campaign is no longer Open (someone else — a participant, another
 *    keeper instance — ended it between our read and our send), that's treated as SUCCESS,
 *    not an error — the expected Web3Campaigns__CampaignNotOpen revert is caught explicitly.
 */
export async function endCampaignSafely(
  campaignId: string,
  keeperWallet: ethers.Wallet,
): Promise<EndResult> {
  const readContract = getEntrypointReadContract()

  const campaignData = await readContract.getCampaign(campaignId)
  const status = Number(campaignData.status)
  const endTime = Number(campaignData.endTime)
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (status !== OPEN_STATUS) {
    return { outcome: 'already-not-open' }
  }
  if (nowSeconds < endTime) {
    return { outcome: 'not-yet-due' }
  }

  const writeContract = getEntrypointContract(keeperWallet)

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      // Someone else may have ended it since the previous attempt — re-check before
      // wasting gas on another send.
      const recheck = await readContract.getCampaign(campaignId)
      if (Number(recheck.status) !== OPEN_STATUS) {
        return { outcome: 'already-not-open' }
      }
      await sleep(RETRY_BACKOFF_MS * attempt)
    }

    try {
      const overrides = await buildEscalatingGasOverrides(keeperWallet, attempt)
      const tx = await writeContract.endCampaign(campaignId, overrides)
      const receipt = await tx.wait(1, TX_WAIT_TIMEOUT_MS)

      // Verify success by observing the resulting STATE, not just tx acceptance.
      const after = await readContract.getCampaign(campaignId)
      if (Number(after.status) === ENDED_STATUS) {
        return { outcome: 'ended', txHash: receipt?.hash ?? tx.hash }
      }
      lastError = new Error(
        `Transaction confirmed but campaign status is ${after.status}, expected Ended(${ENDED_STATUS})`,
      )
    } catch (e: unknown) {
      // Same custom-error extraction shape as mapContractRevertToMessage in web3-service.ts —
      // some RPC providers only surface a decoded revert reason under the nested
      // error.error.message form, so that fallback must be checked here too, or a genuine
      // idempotent "already ended" race gets misclassified as a real failure.
      const reason =
        (e as { reason?: string })?.reason ||
        (e as { shortMessage?: string })?.shortMessage ||
        (e as { error?: { message?: string } })?.error?.message ||
        (e as Error)?.message ||
        ''
      if (reason.includes('Web3Campaigns__CampaignNotOpen')) {
        // Expected race: campaign was ended (or cancelled) by someone else between our
        // pre-check and our send. Idempotent success, not a failure.
        return { outcome: 'already-not-open' }
      }
      if (reason.includes('Web3Campaigns__CampaignNotYetEnded')) {
        // Shouldn't happen given the pre-check, but block.timestamp can be a few seconds
        // behind our local clock — surface as retry-later, not a hard failure.
        return { outcome: 'not-yet-due' }
      }
      lastError = e
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error')
  return { outcome: 'failed', error: message }
}

async function buildEscalatingGasOverrides(
  wallet: ethers.Wallet,
  attempt: number,
): Promise<Record<string, bigint>> {
  if (!wallet.provider) return {}
  const feeData = await wallet.provider.getFeeData()
  const bumpPct = BigInt(100 + GAS_BUMP_PERCENT_PER_ATTEMPT * (attempt - 1))
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    return {
      maxFeePerGas: (feeData.maxFeePerGas * bumpPct) / BigInt(100),
      maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * bumpPct) / BigInt(100),
    }
  }
  if (feeData.gasPrice) {
    return { gasPrice: (feeData.gasPrice * bumpPct) / BigInt(100) }
  }
  return {}
}

/** One sweep: discover endable campaigns, attempt to end each, log + alert as appropriate. */
export async function runSweep(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl)
  const keeperWallet = loadKeeperWallet(provider)

  const endable = await findEndableCampaigns()
  console.log(`[keeper] sweep start — ${endable.length} campaign(s) appear endable`)

  for (const c of endable) {
    const overdueMs = Date.now() - c.endDate.getTime()
    const result = await endCampaignSafely(c.id, keeperWallet)

    switch (result.outcome) {
      case 'ended':
        console.log(`[keeper] ✅ ended campaign ${c.id} ("${c.title}") — tx ${result.txHash}`)
        break
      case 'already-not-open':
        console.log(
          `[keeper] ℹ️  campaign ${c.id} is no longer Open (ended/cancelled by someone else, or already handled) — nothing to do`,
        )
        break
      case 'not-yet-due':
        console.log(
          `[keeper] ⏳ campaign ${c.id} not yet due on-chain (clock skew) — will retry next sweep`,
        )
        break
      case 'failed':
        if (overdueMs > OVERDUE_ALERT_MS) {
          console.error(
            `[keeper] 🚨 ALERT: campaign ${c.id} ("${c.title}") is ${(overdueMs / 60000).toFixed(1)}min overdue and still failing to end after ${MAX_ATTEMPTS} attempts — reason: ${result.error}. This needs on-call attention in a real deployment (BR-K2); note anyone can still call endCampaign permissionlessly as a fallback.`,
          )
        } else {
          console.warn(`[keeper] ⚠️  failed to end campaign ${c.id}: ${result.error}`)
        }
        break
    }
  }

  console.log('[keeper] sweep complete')
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isLoop = args.includes('--loop')
  const intervalFlagIndex = args.indexOf('--interval-minutes')
  const intervalMinutes =
    intervalFlagIndex !== -1
      ? Number(args[intervalFlagIndex + 1])
      : Number(process.env.KEEPER_INTERVAL_MINUTES || '5')

  if (isDryRun) {
    const endable = await findEndableCampaigns()
    console.log(`[keeper] DRY RUN — ${endable.length} endable campaign(s) on chain ${config.chainId}:`)
    for (const c of endable) {
      const overdueMin = (Date.now() - c.endDate.getTime()) / 60000
      console.log(
        `  - campaign ${c.id} ("${c.title}") — endTime ${c.endDate.toISOString()}, overdue by ${overdueMin.toFixed(1)} min`,
      )
    }
    console.log('[keeper] dry run complete — no transactions sent')
    return
  }

  if (!isLoop) {
    await runSweep()
    return
  }

  console.log(`[keeper] starting polling loop — interval ${intervalMinutes}min`)
  // Guards against overlapping sweeps: setInterval fires on a fixed schedule regardless of
  // whether the previous runSweep() has resolved. Without this, a sweep that runs long (even
  // with the per-tx timeout above, MAX_ATTEMPTS x many campaigns can still exceed the
  // interval) would let a second sweep start concurrently, re-reading the same "still Open"
  // campaigns and racing its own redundant endCampaign sends against the first sweep's.
  let sweepInProgress = false
  const tick = async () => {
    if (sweepInProgress) {
      console.warn('[keeper] previous sweep still running — skipping this tick')
      return
    }
    sweepInProgress = true
    try {
      await runSweep()
    } catch (e) {
      console.error('[keeper] sweep error:', e)
    } finally {
      sweepInProgress = false
    }
  }

  await tick()
  setInterval(tick, intervalMinutes * 60 * 1000)
}

// Only auto-run when executed directly (not when imported, e.g. by a future test harness).
if (require.main === module) {
  main().catch((e) => {
    console.error('[keeper] fatal error:', e)
    process.exit(1)
  })
}
