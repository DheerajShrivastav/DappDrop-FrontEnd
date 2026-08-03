import 'server-only'

import { prisma } from './prisma'
import { getAllocationProof } from './allocation'
import { RelayerError, evaluateSponsorshipGates } from './relayer-gates'

/**
 * Sponsored-claim ENQUEUE logic — the Next.js-only half of the relayer (PRD BR-R*). Everything
 * that doesn't need allocation.ts (gating, budgets, kill switch, spend recording — shared with
 * worker/relayer.ts, a standalone tsx entrypoint that CANNOT import allocation.ts, which is
 * 'server-only' and throws outside Next's server webpack compilation) lives in
 * src/lib/relayer-gates.ts instead. This file is imported ONLY by
 * src/app/api/sponsored-claims/route.ts.
 */

export { RelayerError, evaluateSponsorshipGates } from './relayer-gates'
export type { GateCheck } from './relayer-gates'

export type EnqueueResult =
  | { status: 'PENDING' | 'PROCESSING' | 'SUBMITTED' | 'CONFIRMED'; id: string }
  | { status: 'DECLINED'; reason: string }

/**
 * Enqueue a sponsored-claim request. Idempotent: a repeat request for the same
 * (campaignId, account) returns the existing row's status rather than creating a duplicate,
 * UNLESS the prior attempt terminated (FAILED/DECLINED), in which case it's re-evaluated fresh
 * (e.g. the wallet completed Humanity verification since the last decline).
 *
 * @throws RelayerError for requests that can never be valid regardless of gating (no
 *   allocation, already claimed, swept) — these are 4xx-mappable by the route, distinct from a
 *   gating DECLINE (which is a valid request the platform simply won't pay gas for).
 */
export async function enqueueSponsoredClaim(
  campaignId: number,
  account: string,
): Promise<EnqueueResult> {
  const lower = account.toLowerCase()

  const existing = await prisma.sponsoredClaim.findUnique({
    where: { campaignId_account: { campaignId, account: lower } },
  })
  if (existing && existing.status !== 'FAILED' && existing.status !== 'DECLINED') {
    const status = existing.status as 'PENDING' | 'PROCESSING' | 'SUBMITTED' | 'CONFIRMED'
    return { status, id: existing.id }
  }

  const proof = await getAllocationProof(campaignId, lower)
  if (!proof || proof.status === 'not_allocated') {
    throw new RelayerError('This wallet has no allocation in this campaign.')
  }
  if (proof.status === 'claimed') {
    throw new RelayerError('This wallet has already claimed its reward for this campaign.')
  }
  if (proof.status === 'swept') {
    throw new RelayerError(
      'Unclaimed rewards for this campaign have been swept back to the host — claiming is closed.',
    )
  }
  // pending_publish / dispute_window / claimable are all acceptable to enqueue: the worker
  // re-verifies claimability (including the 24h dispute window) via staticCall immediately
  // before every send, so an early request just waits in the queue rather than being rejected.

  const gate = await evaluateSponsorshipGates({ campaignId, account: lower })

  const row = await prisma.sponsoredClaim.upsert({
    where: { campaignId_account: { campaignId, account: lower } },
    create: {
      campaignId,
      account: lower,
      amount: proof.amount,
      proof: proof.proof,
      token: proof.token,
      status: gate.ok ? 'PENDING' : 'DECLINED',
      declineReason: gate.ok ? null : gate.reason,
      processedAt: gate.ok ? null : new Date(),
    },
    update: {
      amount: proof.amount,
      proof: proof.proof,
      token: proof.token,
      status: gate.ok ? 'PENDING' : 'DECLINED',
      declineReason: gate.ok ? null : gate.reason,
      attempts: 0,
      lastError: null,
      processedAt: gate.ok ? null : new Date(),
    },
  })

  return gate.ok ? { status: 'PENDING', id: row.id } : { status: 'DECLINED', reason: gate.reason! }
}

/** Fetch a single request's current status (for a client polling after enqueue). */
export async function getSponsoredClaimStatus(campaignId: number, account: string) {
  return prisma.sponsoredClaim.findUnique({
    where: { campaignId_account: { campaignId, account: account.toLowerCase() } },
  })
}
