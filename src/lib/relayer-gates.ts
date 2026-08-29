import { prisma } from './prisma'

/**
 * Sponsored-claim gating + budget bookkeeping (PRD BR-R*) — deliberately NOT 'server-only'.
 *
 * This is split out of src/lib/relayer.ts specifically so worker/relayer.ts (a standalone tsx
 * entrypoint, not a Next.js request) can import it directly. relayer.ts imports allocation.ts
 * (for getAllocationProof), and allocation.ts is marked 'server-only' — which throws
 * unconditionally outside Next's webpack server compilation (verified empirically, same
 * limitation worker/keeper.ts's docstring already flags). Since JS module evaluation is
 * all-or-nothing per file, importing ANY export from relayer.ts would drag that throw in with
 * it. Everything the WORKER needs (gates, budgets, kill switch, spend recording) lives here,
 * with no dependency on allocation.ts; only enqueueSponsoredClaim/getSponsoredClaimStatus (used
 * exclusively by the Next.js API route, never the worker) stay in relayer.ts.
 *
 * This module NEVER touches the relayer's signing key or sends a transaction — that lives in
 * worker/relayer.ts, mirroring the key-isolation principle in src/lib/signer.ts/worker/keeper.ts.
 *
 * The reward always goes to the allocated account by contract design — claimERC20For's `amount`
 * and `proof` are bound to `account`, never the caller (verified against docs/REWARD_SYSTEM.md
 * and the deployed ABI). Every check in this file governs ONE thing only: whether the PLATFORM
 * pays gas for a claim. Self-claim is completely independent of everything here.
 */

export class RelayerError extends Error {}

// Defaults are deliberately conservative testnet placeholders (PRD Q6 — "smallest reasonable
// default + flag", docs/DECISIONS_v0.6.0.md). A real deployment must set these per the
// founder's actual sponsorship economics; nothing here assumes a specific number is correct.
const DEFAULT_CAMPAIGN_BUDGET_WEI =
  process.env.RELAYER_DEFAULT_CAMPAIGN_BUDGET_WEI || '20000000000000000' // 0.02 ETH
const GLOBAL_DAILY_BUDGET_WEI = process.env.RELAYER_DAILY_BUDGET_WEI || '100000000000000000' // 0.1 ETH

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

export type GateCheck = { ok: true } | { ok: false; reason: string }

/** Checked first — cheapest and most urgent gate. */
export async function getKillSwitch(): Promise<{ enabled: boolean; reason: string | null }> {
  const row = await prisma.relayerControl.findUnique({ where: { id: 1 } })
  return { enabled: row?.killSwitchEnabled ?? false, reason: row?.killSwitchReason ?? null }
}

export async function setKillSwitch(enabled: boolean, reason?: string): Promise<void> {
  await prisma.relayerControl.upsert({
    where: { id: 1 },
    create: { id: 1, killSwitchEnabled: enabled, killSwitchReason: reason ?? null },
    update: { killSwitchEnabled: enabled, killSwitchReason: reason ?? null },
  })
}

/** Lazily creates a campaign's budget row with the config default on first reference. */
export async function getCampaignBudget(campaignId: number) {
  const existing = await prisma.campaignSponsorshipBudget.findUnique({ where: { campaignId } })
  if (existing) return existing
  return prisma.campaignSponsorshipBudget.upsert({
    where: { campaignId },
    create: { campaignId, budgetWei: DEFAULT_CAMPAIGN_BUDGET_WEI },
    update: {},
  })
}

/** Lazily creates today's (UTC) daily spend row. */
export async function getDailySpend() {
  const date = todayUTC()
  const existing = await prisma.relayerDailySpend.findUnique({ where: { date } })
  if (existing) return existing
  return prisma.relayerDailySpend.upsert({ where: { date }, create: { date }, update: {} })
}

/**
 * Gates (a)-(d) from the P2 spec. Called at enqueue time (fast UX — obviously-doomed requests
 * get an immediate, UI-showable decline) AND again by the worker immediately before
 * pre-simulating/sending (the AUTHORITATIVE check — budget headroom especially is a moving
 * target that must be re-verified atomically right before spend, never trusted from an earlier
 * evaluation). Never sponsor-blocks self-claim; every decline reason says so explicitly.
 */
export async function evaluateSponsorshipGates(params: {
  campaignId: number
  account: string
  /** Pass the actual estimated gas cost right before sending for a precise headroom check;
   * omitted at enqueue time, when only "is there ANY headroom" can be known. */
  estimatedGasCostWei?: bigint
}): Promise<GateCheck> {
  const kill = await getKillSwitch()
  if (kill.enabled) {
    return {
      ok: false,
      reason:
        `Sponsored claims are temporarily paused${kill.reason ? ` (${kill.reason})` : ''}. You can still claim your reward yourself.`,
    }
  }

  const user = await prisma.user.findUnique({
    where: { walletAddress: params.account.toLowerCase() },
    select: { moderationFlagged: true },
  })
  if (user?.moderationFlagged) {
    return {
      ok: false,
      reason: 'This wallet is not eligible for sponsored claims. You can still claim your reward yourself.',
    }
  }

  // NO Humanity gate here, deliberately. This used to require isUserVerified() unconditionally,
  // which made sponsorship contradict the campaign's own policy: no campaign on this platform
  // sets humanityGated, yet every sponsored claim demanded Humanity verification — so gasless
  // claims declined for essentially every real participant and the feature was dead in practice.
  //
  // Sybil defence does not depend on it. enqueueSponsoredClaim refuses any wallet that isn't
  // already entitled to this campaign's reward, so an attacker cannot mint wallets to farm gas:
  // ERC20_MERKLE and NFT require a real leaf + proof in the published tree, and RANK_TIERED
  // requires on-chain `qualified`. Spend is separately bounded by the per-campaign budget and the
  // global daily cap below, the one-row-per-(campaign, wallet) constraint prevents repeat claims,
  // and moderationFlagged above still excludes abusers.
  //
  // SCORE_TIERED is the weakest of the four: it has no Merkle tree, and enqueue accepts any
  // nonzero score that matches a configured tier (see the note in relayer.ts on why the
  // `qualified` check stays rank-only there). Entitlement is still on-chain — a score is earned
  // by verified task completion, not self-asserted — but if sponsorship abuse ever shows up in
  // practice, this is the path to tighten first.
  //
  // Humanity gating remains enforced where it actually matters, on the MERKLE paths: for a
  // humanityGated campaign, tree-build filtering (allocation.ts / nft-allocation.ts) leaves an
  // unverified wallet with no leaf, so it cannot claim at all — sponsored or self-claimed. That
  // is enforcement; this gate never was. Note the tiered modes have no tree and therefore no
  // equivalent build-time filter, so humanityGated + tiered is not a combination this codebase
  // currently enforces anywhere — worth resolving before a tiered campaign relies on it.

  const campaignBudget = await getCampaignBudget(params.campaignId)
  const campaignRemaining = BigInt(campaignBudget.budgetWei) - BigInt(campaignBudget.spentWei)
  if (campaignRemaining <= BigInt(0)) {
    return {
      ok: false,
      reason: "This campaign's sponsorship budget has been exhausted. You can still claim your reward yourself.",
    }
  }

  const daily = await getDailySpend()
  const dailyRemaining = BigInt(GLOBAL_DAILY_BUDGET_WEI) - BigInt(daily.spentWei)
  if (dailyRemaining <= BigInt(0)) {
    return {
      ok: false,
      reason:
        "The platform's daily sponsorship budget has been exhausted for today. You can still claim your reward yourself.",
    }
  }

  if (params.estimatedGasCostWei !== undefined) {
    if (params.estimatedGasCostWei > campaignRemaining) {
      return {
        ok: false,
        reason:
          "This campaign's remaining sponsorship budget cannot cover this claim's gas cost. You can still claim your reward yourself.",
      }
    }
    if (params.estimatedGasCostWei > dailyRemaining) {
      return {
        ok: false,
        reason:
          "The platform's remaining daily sponsorship budget cannot cover this claim's gas cost. You can still claim your reward yourself.",
      }
    }
  }

  return { ok: true }
}

/**
 * Record a confirmed spend against both the per-campaign and global-daily budgets — called by
 * the worker only after a sponsored tx actually confirms on-chain.
 *
 * MUST be a single atomic UPDATE per row, not read-then-write: two worker processes confirming
 * different sponsored claims at the same moment (a cron one-shot overlapping an always-on
 * --loop, or two instances overlapping during a redeploy — the in-memory tickInProgress guard
 * only protects a single --loop instance against itself) would otherwise both read the same
 * spentWei, both compute their increment from that stale value, and the second write would
 * silently clobber the first (a lost update — real under Postgres's default READ COMMITTED,
 * confirmed against this datasource). That would make evaluateSponsorshipGates overestimate
 * remaining headroom — quietly defeating the one budget/kill-switch safety mechanism this was
 * built to enforce. A single server-side UPDATE...SET x = x + $1 is atomic regardless of
 * isolation level, which is exactly what Prisma's numeric `increment` compiles to — done here
 * in raw SQL only because spentWei is a string column (base units exceed the safe JS integer
 * range, same convention as AllocationEntry.amount), so it can't use `increment` directly.
 */
export async function recordSponsorshipSpend(campaignId: number, gasCostWei: bigint): Promise<void> {
  const date = todayUTC()

  // Ensure the daily row exists (idempotent — a concurrent creator is safe via the unique
  // constraint) before entering the transaction below.
  await prisma.relayerDailySpend.upsert({ where: { date }, create: { date }, update: {} })

  // Interactive transaction, not a batch: a 0-row UPDATE is not a Postgres error (nothing to
  // roll back on its own), so the existence checks below only actually prevent a partial
  // write — one budget incremented, the other silently skipped — because throwing inside an
  // interactive transaction's callback rolls back everything already executed in it.
  await prisma.$transaction(async (tx) => {
    const campaignRows = await tx.$executeRaw`
      UPDATE "CampaignSponsorshipBudget"
      SET "spentWei" = ("spentWei"::numeric + ${gasCostWei.toString()}::numeric)::text,
          "updatedAt" = now()
      WHERE "campaignId" = ${campaignId}
    `
    if (campaignRows === 0) {
      throw new RelayerError(
        `recordSponsorshipSpend: no CampaignSponsorshipBudget row for campaign ${campaignId} — spend of ${gasCostWei} wei was NOT recorded`,
      )
    }

    const dailyRows = await tx.$executeRaw`
      UPDATE "RelayerDailySpend"
      SET "spentWei" = ("spentWei"::numeric + ${gasCostWei.toString()}::numeric)::text,
          "updatedAt" = now()
      WHERE "date" = ${date}
    `
    if (dailyRows === 0) {
      throw new RelayerError(
        `recordSponsorshipSpend: no RelayerDailySpend row for ${date} — spend of ${gasCostWei} wei was NOT recorded against the daily budget`,
      )
    }
  })
}
