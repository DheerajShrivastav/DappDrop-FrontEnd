import 'server-only'

import { prisma } from './prisma'
import { getAllocationProof } from './allocation'
import { getNFTAllocationProof } from './nft-allocation'
import { getCampaignSettlement, getTieredRewardStatus, getTieredTiers } from './web3-service'
import { RelayerError, evaluateSponsorshipGates } from './relayer-gates'

/**
 * Sponsored-claim ENQUEUE logic — the Next.js-only half of the relayer (PRD BR-R*). Everything
 * that doesn't need allocation.ts (gating, budgets, kill switch, spend recording — shared with
 * worker/relayer.ts, a standalone tsx entrypoint that CANNOT import allocation.ts, which is
 * 'server-only' and throws outside Next's server webpack compilation) lives in
 * src/lib/relayer-gates.ts instead. This file is imported ONLY by
 * src/app/api/sponsored-claims/route.ts.
 *
 * P3 CP1 added a second claim KIND — TIERED (claimRewardFor on the campaign's pinned
 * OnChainRewardModule) — and P3 CP2 a third — NFT (claimNFTFor on the campaign's pinned
 * NFTSettlementModule) — alongside the original ERC20_MERKLE (claimERC20For on the entrypoint).
 * The kind is auto-detected from the campaign's on-chain settlement mode, never client-supplied
 * (a caller declaring the wrong kind could otherwise route a claim at the wrong contract).
 */

export { RelayerError, evaluateSponsorshipGates } from './relayer-gates'
export type { GateCheck } from './relayer-gates'

export type EnqueueResult =
  | { status: 'PENDING' | 'PROCESSING' | 'SUBMITTED' | 'CONFIRMED'; id: string }
  | { status: 'DECLINED'; reason: string }

/** Mirrors OnChainRewardLib.matchRankTier/matchScoreTier — used only to decide whether a
 * tiered claim is even worth enqueueing (a zero-match is a doomed claim, same spirit as
 * getAllocationProof's not_allocated check for the Merkle path). */
function tieredAmountMatches(
  isRank: boolean,
  tiers: { threshold: string; thresholdEnd: string }[],
  rankOrScore: number,
): boolean {
  return isRank
    ? tiers.some((t) => rankOrScore >= Number(t.threshold) && rankOrScore <= Number(t.thresholdEnd))
    : tiers.some((t) => rankOrScore >= Number(t.threshold))
}

/**
 * Enqueue a sponsored-claim request. Idempotent: a repeat request for the same
 * (campaignId, account) returns the existing row's status rather than creating a duplicate,
 * UNLESS the prior attempt terminated (FAILED/DECLINED), in which case it's re-evaluated fresh
 * (e.g. the wallet completed Humanity verification since the last decline).
 *
 * @throws RelayerError for requests that can never be valid regardless of gating (no
 *   allocation, already claimed, swept, not currently qualified) — these are 4xx-mappable by
 *   the route, distinct from a gating DECLINE (which is a valid request the platform simply
 *   won't pay gas for).
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

  const settlement = await getCampaignSettlement(String(campaignId))
  const isTiered =
    settlement?.mode === 'RANK_TIERED' || settlement?.mode === 'SCORE_TIERED'
  const isNFT = settlement?.mode === 'NFT'

  let createData: {
    kind: string
    amount: string
    proof: string[]
    token: string
    nftStandard?: string | null
    tokenId?: string | null
  }

  if (isNFT) {
    const nftProof = await getNFTAllocationProof(campaignId, lower)
    if (!nftProof || nftProof.status === 'not_allocated') {
      throw new RelayerError('This wallet has no NFT allocation in this campaign.')
    }
    if (nftProof.status === 'claimed') {
      throw new RelayerError('This wallet has already claimed its NFT for this campaign.')
    }
    if (nftProof.status === 'swept') {
      throw new RelayerError(
        'Unclaimed NFTs for this campaign have been swept back to the host — claiming is closed.',
      )
    }
    if (!nftProof.standard || !nftProof.tokenId) {
      throw new RelayerError('This wallet\'s NFT allocation is missing standard/tokenId data.')
    }
    // pending_publish / dispute_window / claimable are all acceptable to enqueue, same as
    // ERC20_MERKLE — the worker re-verifies via staticCall immediately before every send.
    createData = {
      kind: 'NFT',
      amount: nftProof.amount,
      proof: nftProof.proof,
      token: nftProof.tokenAddress,
      nftStandard: nftProof.standard,
      tokenId: nftProof.tokenId,
    }
  } else if (isTiered) {
    const status = await getTieredRewardStatus(String(campaignId), lower)
    if (!status) {
      throw new RelayerError('This campaign has no tiered reward module pinned.')
    }
    if (status.claimed) {
      throw new RelayerError('This wallet has already claimed its reward for this campaign.')
    }
    const isRank = status.mode === 'RANK_TIERED'
    const rankOrScore = isRank ? status.rank : status.score
    if (isRank && (!status.qualified || rankOrScore === 0)) {
      throw new RelayerError(
        'This wallet is not currently qualified (a required task is incomplete).',
      )
    }
    if (!isRank && rankOrScore === 0) {
      throw new RelayerError('This wallet has no score in this campaign.')
    }
    const tiers = await getTieredTiers(String(campaignId))
    if (!tieredAmountMatches(isRank, tiers, rankOrScore)) {
      throw new RelayerError(
        `This wallet's ${isRank ? 'rank' : 'score'} does not fall into any configured reward tier.`,
      )
    }
    // amount/proof are unused for TIERED — the module computes payout on-chain at claim time
    // (kept as empty placeholders only because the columns are NOT NULL, shared with the
    // ERC20_MERKLE row shape).
    createData = {
      kind: 'TIERED',
      amount: '0',
      proof: [],
      token: settlement?.erc20Token ?? '',
    }
  } else {
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
    createData = {
      kind: 'ERC20_MERKLE',
      amount: proof.amount,
      proof: proof.proof,
      token: proof.token,
    }
  }

  const gate = await evaluateSponsorshipGates({ campaignId, account: lower })

  const row = await prisma.sponsoredClaim.upsert({
    where: { campaignId_account: { campaignId, account: lower } },
    create: {
      campaignId,
      account: lower,
      ...createData,
      status: gate.ok ? 'PENDING' : 'DECLINED',
      declineReason: gate.ok ? null : gate.reason,
      processedAt: gate.ok ? null : new Date(),
    },
    update: {
      ...createData,
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
