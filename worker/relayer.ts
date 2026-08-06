/**
 * Relayer — the standalone worker that sponsors (pays gas for) claims on behalf of qualifying
 * wallets (PRD BR-R*). Two claim KINDS as of P3 CP1: ERC20_MERKLE (claimERC20For on the
 * entrypoint, P2) and TIERED (claimRewardFor on the campaign's PINNED OnChainRewardModule, P3
 * — resolved fresh via getPinnedRewardModule every time, never the global default). A
 * STANDALONE Node entrypoint, NOT a Next.js route handler — per the standing architecture
 * decision, this is a queue PROCESSOR; `POST /api/sponsored-claims` only enqueues
 * (src/lib/relayer.ts auto-detects the kind from the campaign's on-chain settlement mode +
 * src/lib/relayer-gates.ts + src/app/api/sponsored-claims). Same `tsx` pattern as
 * worker/keeper.ts (Node's native TS stripping does not resolve `@/*`).
 *
 * TRUST POSTURE — treat this key like the signer key (extra care, per the founder's framing):
 * - RELAYER_PRIVATE_KEY is a FUNDED hot wallet. It can only ever pay gas for a claim whose
 *   recipient is bound to `account` — by the Merkle leaf for ERC20_MERKLE, or by the
 *   participant's own on-chain rank/score state for TIERED — verified against the deployed
 *   contract (docs/REWARD_SYSTEM.md: "tokens are always paid to `account`, never the caller";
 *   `claimRewardFor`'s payout is "computed purely from `_participant`'s own on-chain rank/score
 *   state") — so a compromised relayer key can waste this wallet's ETH but can NEVER redirect a
 *   reward. The worst case is a funded hot wallet drained of gas money, not a stolen payout.
 *   Still: separate, low-value key, never SIGNER_ROLE/SETTLER_ROLE/KEEPER_PRIVATE_KEY.
 * - Every sponsored send is PRE-SIMULATED (staticCall) — the relayer NEVER pays gas for a tx
 *   that would revert. This is the main defense against griefing the relayer's balance.
 * - GATING happens twice: once at enqueue (src/lib/relayer.ts, fast decline UX — it re-exports
 *   evaluateSponsorshipGates from relayer-gates.ts) and again here, authoritatively, immediately
 *   before simulate+send — budget headroom especially must never be trusted from an earlier read.
 * - KILL SWITCH (RelayerControl.killSwitchEnabled, DB-backed so it's flippable without a
 *   redeploy) halts every tick immediately. Self-claim reads nothing from this table.
 *
 * Modes (same code, two CLI entry points, matching worker/keeper.ts):
 *   npm run relayer            — one-shot: process one queue tick and exit (cron/manual)
 *   npm run relayer:loop       — always-on: tick, then poll every RELAYER_INTERVAL_MINUTES
 *   npm run relayer:dry-run    — list PENDING requests and their gate evaluation WITHOUT
 *                                 sending anything or requiring RELAYER_PRIVATE_KEY
 *   npm run relayer -- --kill "reason"    — flips the kill switch ON
 *   npm run relayer -- --resume            — flips the kill switch OFF
 *
 * Config (env, server-side only — never NEXT_PUBLIC_):
 *   RELAYER_PRIVATE_KEY              required to send txs. Dedicated funded hot wallet. On
 *                                     THIS throwaway test deployment it MAY reuse another test
 *                                     key (docs/DECISIONS_v0.6.0.md Decision 1) — a real
 *                                     deployment MUST use a separate low-value key.
 *   RELAYER_DEFAULT_CAMPAIGN_BUDGET_WEI   per-campaign sponsorship ceiling default (wei).
 *   RELAYER_DAILY_BUDGET_WEI              global daily sponsorship ceiling (wei).
 *   RELAYER_LOW_BALANCE_WARN_WEI     balance below which every tick logs a loud warning.
 *   RELAYER_MAX_ATTEMPTS             retry/replacement cap per request per tick run (default 5).
 *   RELAYER_TX_TIMEOUT_MS            max time to wait for a submitted tx before treating it as
 *                                     stuck and replacing it (same nonce, bumped gas).
 *   RELAYER_BATCH_SIZE               PENDING requests processed per tick (default 10).
 *   RELAYER_INTERVAL_MINUTES         polling interval for --loop (default 2).
 *
 * OUT OF SCOPE (deliberately, P3 CP2): NFT sponsored claims (claimNFTFor on
 * NFTSettlementModule) — the "kind" model this file already has (ERC20_MERKLE/TIERED) is
 * written to slot NFT in the same way; not wired yet.
 */
import 'dotenv/config'

import { ethers } from 'ethers'
import config from '@/app/config'
import {
  getEntrypointContract,
  getEntrypointReadContract,
  getPinnedRewardModule,
  getOnChainRewardModuleContract,
  mapContractRevertToMessage,
} from '@/lib/web3-service'
import { evaluateSponsorshipGates, getKillSwitch, setKillSwitch, recordSponsorshipSpend } from '@/lib/relayer-gates'
import { notifySponsoredClaimConfirmed } from '@/lib/notifications'
import { prisma } from '@/lib/prisma'

const MAX_ATTEMPTS = Number(process.env.RELAYER_MAX_ATTEMPTS || '5')
const RETRY_BACKOFF_MS = 3000
const GAS_BUMP_PERCENT_PER_ATTEMPT = 20
const TX_WAIT_TIMEOUT_MS = Number(process.env.RELAYER_TX_TIMEOUT_MS || '120000')
const BATCH_SIZE = Number(process.env.RELAYER_BATCH_SIZE || '10')
const LOW_BALANCE_WARN_WEI = BigInt(process.env.RELAYER_LOW_BALANCE_WARN_WEI || '10000000000000000') // 0.01 ETH

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** The relayer's own funded signing key. Separate chokepoint from signer.ts/keeper.ts keys —
 * this key must never hold SIGNER_ROLE or the keeper role. */
function loadRelayerWallet(provider: ethers.Provider): ethers.Wallet {
  // Falls back to SIGNER_RELAYER_KEY (a combined signer+relayer test key) — acceptable ONLY
  // on this throwaway deployment (docs/DECISIONS_v0.6.0.md Decision 1). A real deployment
  // MUST set RELAYER_PRIVATE_KEY to its own dedicated low-value key.
  const pk = process.env.RELAYER_PRIVATE_KEY || process.env.SIGNER_RELAYER_KEY
  if (!pk) {
    throw new Error(
      'RELAYER_PRIVATE_KEY (or SIGNER_RELAYER_KEY on this test deployment) is not set — the relayer needs a dedicated funded wallet to sponsor claims.',
    )
  }
  return new ethers.Wallet(pk, provider)
}

async function warnIfLowBalance(wallet: ethers.Wallet): Promise<bigint> {
  const balance = await wallet.provider!.getBalance(wallet.address)
  if (balance < LOW_BALANCE_WARN_WEI) {
    console.warn(
      `[relayer] ⚠️  LOW BALANCE: ${wallet.address} has ${ethers.formatEther(balance)} ETH — sponsorship will start failing once this runs out. Top it up.`,
    )
  }
  return balance
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

export type ProcessResult =
  | { outcome: 'confirmed'; txHash: string; gasCostWei: bigint }
  | { outcome: 'declined'; reason: string }
  | { outcome: 'retry-later'; reason: string }
  | { outcome: 'failed'; error: string }

/**
 * Processes exactly one queued request, safely and idempotently:
 * 1. Atomic PENDING->PROCESSING claim (cross-instance concurrency guard — if two worker
 *    processes race on the same row, only one wins; the other treats it as "someone else has
 *    it" and moves on, rather than double-submitting).
 * 2. Re-evaluates ALL FOUR gates authoritatively — never trusts the enqueue-time snapshot.
 * 3. PRE-SIMULATES (staticCall) before ever paying gas. A transient revert (dispute window
 *    still active, or root not yet published) re-queues the request instead of failing it —
 *    it WILL become claimable later, unlike a genuinely invalid claim.
 * 4. Sends for real only after a clean simulation, with stuck-tx REPLACEMENT (same nonce,
 *    escalating gas) rather than a second independent send, so a slow-to-confirm tx can never
 *    turn into a double-spend of the relayer's gas.
 * 5. On confirmation, atomically books the gas cost against both budget rows
 *    (recordSponsorshipSpend) before marking CONFIRMED.
 */
export async function processClaim(claimId: string, wallet: ethers.Wallet): Promise<ProcessResult> {
  const claimed = await prisma.sponsoredClaim.updateMany({
    where: { id: claimId, status: 'PENDING' },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  })
  if (claimed.count === 0) {
    return { outcome: 'retry-later', reason: 'picked up by another worker instance' }
  }

  const row = await prisma.sponsoredClaim.findUniqueOrThrow({ where: { id: claimId } })

  const gate = await evaluateSponsorshipGates({ campaignId: row.campaignId, account: row.account })
  if (!gate.ok) {
    await prisma.sponsoredClaim.update({
      where: { id: claimId },
      data: { status: 'DECLINED', declineReason: gate.reason, processedAt: new Date() },
    })
    return { outcome: 'declined', reason: gate.reason }
  }

  // P3 CP1: two claim kinds share this same simulate/send/retry body. ERC20_MERKLE targets the
  // entrypoint's claimERC20For(campaignId, account, amount, proof); TIERED targets
  // claimRewardFor(campaignId, account) on the campaign's PINNED OnChainRewardModule — resolved
  // fresh here via getPinnedRewardModule, NEVER the global default (docs/ARCHITECTURE.md).
  const isTiered = row.kind === 'TIERED'
  let targetContract: ethers.Contract
  let claimArgs: unknown[]
  const methodName = isTiered ? 'claimRewardFor' : 'claimERC20For'

  if (isTiered) {
    const moduleAddress = await getPinnedRewardModule(String(row.campaignId))
    if (!moduleAddress) {
      await prisma.sponsoredClaim.update({
        where: { id: claimId },
        data: {
          status: 'FAILED',
          lastError: 'No tiered reward module pinned for this campaign',
          processedAt: new Date(),
        },
      })
      return { outcome: 'failed', error: 'no pinned reward module' }
    }
    targetContract = getOnChainRewardModuleContract(moduleAddress, wallet)
    claimArgs = [row.campaignId, row.account]
  } else {
    targetContract = getEntrypointContract(wallet)
    claimArgs = [row.campaignId, row.account, row.amount, row.proof as unknown as string[]]
  }

  try {
    await targetContract[methodName].staticCall(...claimArgs)
  } catch (e: unknown) {
    const raw =
      (e as { reason?: string })?.reason ||
      (e as { shortMessage?: string })?.shortMessage ||
      (e as { error?: { message?: string } })?.error?.message ||
      (e as Error)?.message ||
      ''
    const reason = mapContractRevertToMessage(e)
    // RootDisputeWindowActive/MerkleRootNotSet only ever apply to ERC20_MERKLE (tiered has no
    // root); CampaignNotYetEnded can apply to either kind if enqueued just before Ended.
    const isTransient =
      raw.includes('Web3Campaigns__RootDisputeWindowActive') ||
      raw.includes('Web3Campaigns__MerkleRootNotSet') ||
      raw.includes('Web3Campaigns__CampaignNotYetEnded')

    if (isTransient && row.attempts < MAX_ATTEMPTS) {
      await prisma.sponsoredClaim.update({
        where: { id: claimId },
        data: { status: 'PENDING', lastError: reason },
      })
      return { outcome: 'retry-later', reason }
    }
    // Either terminal (bad proof / already claimed / swept) or a transient condition that
    // has now exhausted its retry budget (e.g. a root stuck mid-dispute-window for far
    // longer than expected) — either way, stop silently retrying and surface it.
    await prisma.sponsoredClaim.update({
      where: { id: claimId },
      data: { status: 'FAILED', lastError: reason, processedAt: new Date() },
    })
    return { outcome: 'failed', error: reason }
  }

  const nonce = row.nonce ?? (await wallet.provider!.getTransactionCount(wallet.address, 'pending'))
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const overrides = await buildEscalatingGasOverrides(wallet, attempt)
      const tx = await targetContract[methodName](...claimArgs, { ...overrides, nonce })
      await prisma.sponsoredClaim.update({
        where: { id: claimId },
        data: { status: 'SUBMITTED', nonce, txHash: tx.hash },
      })

      const receipt: ethers.ContractTransactionReceipt | null = await tx.wait(1, TX_WAIT_TIMEOUT_MS)
      if (!receipt) throw new Error('Transaction did not confirm within timeout')

      const gasCostWei: bigint = receipt.gasUsed * receipt.gasPrice
      await recordSponsorshipSpend(row.campaignId, gasCostWei)
      await prisma.sponsoredClaim.update({
        where: { id: claimId },
        data: {
          status: 'CONFIRMED',
          gasUsed: receipt.gasUsed.toString(),
          effGasPrice: receipt.gasPrice.toString(),
          gasCostWei: gasCostWei.toString(),
          processedAt: new Date(),
        },
      })

      // Best-effort notification (BR-N*): the participant gets an in-app confirmation, the host
      // gets a webhook. Never allowed to fail the claim outcome — the tokens are already
      // delivered on-chain; a notification error must not turn a confirmed claim into a failure.
      try {
        const cache = await prisma.campaignCache.findFirst({
          where: { campaignId: row.campaignId },
          select: { hostAddress: true },
        })
        await notifySponsoredClaimConfirmed({
          campaignId: row.campaignId,
          account: row.account,
          txHash: receipt.hash,
          hostAddress: cache?.hostAddress ?? undefined,
          amount: row.amount,
          token: row.token,
        })
      } catch (e) {
        console.warn('[relayer] confirmed-claim notification failed (non-fatal):', e)
      }

      return { outcome: 'confirmed', txHash: receipt.hash, gasCostWei }
    } catch (e: unknown) {
      lastError = e
      const raw =
        (e as { reason?: string })?.reason ||
        (e as { shortMessage?: string })?.shortMessage ||
        (e as { error?: { message?: string } })?.error?.message ||
        (e as Error)?.message ||
        ''
      if (raw.includes('Web3Campaigns__AlreadyClaimedSettlement')) {
        // Idempotent race: self-claim (or a prior stuck attempt that actually landed) beat
        // this attempt. Not a relayer failure — nothing was lost, nothing double-paid.
        await prisma.sponsoredClaim.update({
          where: { id: claimId },
          data: {
            status: 'FAILED',
            lastError: 'Already claimed via another path before this attempt confirmed',
            processedAt: new Date(),
          },
        })
        return { outcome: 'failed', error: 'already claimed via another path' }
      }
      // Anything else: retry at the SAME nonce with bumped gas — a genuine replacement of a
      // stuck/underpriced tx, never a second independent send.
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BACKOFF_MS * attempt)
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error')
  await prisma.sponsoredClaim.update({
    where: { id: claimId },
    data: { status: 'FAILED', lastError: message, processedAt: new Date() },
  })
  return { outcome: 'failed', error: message }
}

/** One queue tick: kill-switch check, low-balance warning, then process up to BATCH_SIZE
 * PENDING requests SERIALLY (one nonce in flight at a time from this process — see the module
 * doc for why this sidesteps distributed nonce coordination rather than building it). */
export async function runQueueTick(): Promise<void> {
  const kill = await getKillSwitch()
  if (kill.enabled) {
    console.log(
      `[relayer] 🛑 kill switch ENABLED${kill.reason ? ` — ${kill.reason}` : ''}. Skipping this tick. Self-claims are completely unaffected.`,
    )
    return
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl)
  const wallet = loadRelayerWallet(provider)
  await warnIfLowBalance(wallet)

  const pending = await prisma.sponsoredClaim.findMany({
    where: { status: 'PENDING' },
    orderBy: { requestedAt: 'asc' },
    take: BATCH_SIZE,
  })
  console.log(`[relayer] tick start — ${pending.length} PENDING request(s)`)

  for (const claim of pending) {
    const result = await processClaim(claim.id, wallet)
    switch (result.outcome) {
      case 'confirmed':
        console.log(
          `[relayer] ✅ sponsored claim ${claim.id} (campaign ${claim.campaignId}, ${claim.account}) — tx ${result.txHash}, cost ${ethers.formatEther(result.gasCostWei)} ETH`,
        )
        break
      case 'declined':
        console.log(`[relayer] 🚫 declined ${claim.id} (campaign ${claim.campaignId}, ${claim.account}): ${result.reason}`)
        break
      case 'retry-later':
        console.log(`[relayer] ⏳ ${claim.id}: ${result.reason}`)
        break
      case 'failed':
        console.error(`[relayer] ❌ ${claim.id} (campaign ${claim.campaignId}, ${claim.account}) failed: ${result.error}`)
        break
    }
  }
  console.log('[relayer] tick complete')
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)

  const killIndex = args.indexOf('--kill')
  if (killIndex !== -1) {
    const reason = args[killIndex + 1] && !args[killIndex + 1].startsWith('--') ? args[killIndex + 1] : undefined
    await setKillSwitch(true, reason)
    console.log(`[relayer] 🛑 kill switch ENABLED${reason ? ` — ${reason}` : ''}. Self-claims remain available.`)
    return
  }
  if (args.includes('--resume')) {
    await setKillSwitch(false)
    console.log('[relayer] ▶️  kill switch DISABLED — sponsorship resumed.')
    return
  }

  const isDryRun = args.includes('--dry-run')
  const isLoop = args.includes('--loop')
  const intervalFlagIndex = args.indexOf('--interval-minutes')
  const intervalMinutes =
    intervalFlagIndex !== -1
      ? Number(args[intervalFlagIndex + 1])
      : Number(process.env.RELAYER_INTERVAL_MINUTES || '2')

  if (isDryRun) {
    const kill = await getKillSwitch()
    const pending = await prisma.sponsoredClaim.findMany({
      where: { status: 'PENDING' },
      orderBy: { requestedAt: 'asc' },
      take: BATCH_SIZE,
    })
    console.log(
      `[relayer] DRY RUN — kill switch ${kill.enabled ? `ENABLED (${kill.reason ?? 'no reason set'})` : 'disabled'}; ${pending.length} PENDING request(s):`,
    )
    for (const c of pending) {
      const gate = await evaluateSponsorshipGates({ campaignId: c.campaignId, account: c.account })
      console.log(
        `  - ${c.id} campaign ${c.campaignId} ${c.account} amount=${c.amount} — ${gate.ok ? 'would attempt (still needs staticCall simulation)' : `would DECLINE: ${gate.reason}`}`,
      )
    }
    console.log('[relayer] dry run complete — no transactions sent, RELAYER_PRIVATE_KEY not required')
    return
  }

  if (!isLoop) {
    await runQueueTick()
    return
  }

  console.log(`[relayer] starting polling loop — interval ${intervalMinutes}min`)
  let tickInProgress = false
  const tick = async () => {
    if (tickInProgress) {
      console.warn('[relayer] previous tick still running — skipping this cycle')
      return
    }
    tickInProgress = true
    try {
      await runQueueTick()
    } catch (e) {
      console.error('[relayer] tick error:', e)
    } finally {
      tickInProgress = false
    }
  }

  await tick()
  setInterval(tick, intervalMinutes * 60 * 1000)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[relayer] fatal error:', e)
    process.exit(1)
  })
}
