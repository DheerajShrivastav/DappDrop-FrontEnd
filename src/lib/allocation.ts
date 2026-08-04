import 'server-only'

import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import { ethers } from 'ethers'
import { prisma } from './prisma'
import {
  getCampaignByIdWithMetadata,
  getCampaignParticipants,
  getERC20SettlementOnChain,
  getERC20TokenInfo,
} from './web3-service'
import { isHumanityVerifiedDurable } from './humanity-service'
import { notifyAllocationsPublished, notifyAllocationProposalReady } from './notifications'
import { ROOT_DISPUTE_WINDOW_MS } from './campaign-lifecycle'

/**
 * Allocation & Merkle pipeline (PRD BR-M1/BR-M2). Triggered on-demand (poll-for-now, per the
 * P1 scope — a background trigger off `Ended` is keeper/worker scope, explicitly out of this
 * phase) when a host visits the "Review & publish allocations" screen for an Ended campaign.
 *
 * The pipeline PROPOSES an allocation; it never publishes on-chain itself (BR-M3) — the host
 * reviews the proposal and signs `setERC20MerkleRoot` from their own wallet.
 *
 * CP2 ships exactly ONE allocation policy (PRD Q3 default): EQUAL_SPLIT — the campaign's
 * escrowed ERC20 balance split evenly among wallets that completed every task in the
 * campaign, minus any wallet excluded by humanity gating if the host enabled it.
 */

const ZERO_ROOT =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

export class AllocationError extends Error {}

export type ProposedAllocation = {
  campaignId: number
  version: number
  root: string
  token: string
  totalAmount: string
  policy: string
  entries: { wallet: string; amount: string; tasksCompleted: number }[]
  excludedForHumanity: string[]
  reconciliation: { escrowed: string; allocated: string; withinBudget: boolean }
}

/**
 * Gather qualifying completions, apply the policy (+ humanity filtering), reconcile against
 * escrow, build the OZ Merkle tree, and persist it as a new PROPOSED version. Hard-fails
 * (throws AllocationError) rather than ever producing a tree that over-allocates escrow.
 */
export async function proposeAllocation(campaignId: number): Promise<ProposedAllocation> {
  const campaign = await getCampaignByIdWithMetadata(String(campaignId))
  if (!campaign) throw new AllocationError('Campaign not found')
  if (campaign.status !== 'Ended' && campaign.status !== 'Closed') {
    throw new AllocationError(
      'Allocations can only be proposed once the campaign has Ended.',
    )
  }

  const cache = await prisma.campaignCache.findFirst({ where: { campaignId } })
  const policy = cache?.allocationPolicy || 'EQUAL_SPLIT'
  const humanityGated = cache?.humanityGated ?? false
  if (policy !== 'EQUAL_SPLIT') {
    // CP2 scope: only EQUAL_SPLIT is implemented. Surfacing rather than silently defaulting.
    throw new AllocationError(
      `Allocation policy "${policy}" is not yet implemented — only EQUAL_SPLIT ships in this phase.`,
    )
  }

  const settlement = await getERC20SettlementOnChain(String(campaignId))
  if (settlement.token === ethers.ZeroAddress) {
    throw new AllocationError('This campaign has no ERC20 reward configured.')
  }

  const totalTasks = campaign.tasks.length
  if (totalTasks === 0) {
    throw new AllocationError('This campaign has no tasks to qualify against.')
  }

  const participants = await getCampaignParticipants(campaign)
  let qualifying = participants.filter((p) => p.tasksCompleted >= totalTasks)

  // PRIMARY humanity-gating enforcement (docs/HUMANITY_GATING.md point 1): for a gated
  // campaign, exclude every wallet not durably Humanity-verified from the leaf set. A wallet
  // with no leaf is mathematically unable to claim — no gas, no signature, no new trust; the
  // on-chain root commitment does all the work. This is the strongest enforcement point, which
  // is exactly why it must use the DURABLE status read (isHumanityVerifiedDurable), NOT the
  // TTL-bounded courtesy read (isUserVerified) the relayer uses: excluding a wallet here is
  // permanent for this allocation, so a merely-aged cache must never masquerade as "unverified"
  // and strip a genuinely-verified human of rewards they earned. Revoked wallets (their
  // humanityVerified flipped false) are naturally excluded from this and every future build.
  const excludedForHumanity: string[] = []
  if (humanityGated) {
    const checked = await Promise.all(
      qualifying.map(async (p) => ({
        p,
        verified: await isHumanityVerifiedDurable(p.address),
      })),
    )
    qualifying = checked
      .filter((c) => {
        if (!c.verified) excludedForHumanity.push(c.p.address)
        return c.verified
      })
      .map((c) => c.p)
  }

  if (qualifying.length === 0) {
    throw new AllocationError(
      'No qualifying wallets to allocate to' +
        (humanityGated
          ? ' (none completed every task and are Humanity-verified).'
          : ' (none completed every task).'),
    )
  }

  // Budget ceiling: escrowed minus whatever has already been distributed against a prior
  // root (0 on a first proposal). Floor division so the computed total can NEVER exceed the
  // ceiling — any remainder wei stays in escrow (under-allocation is safe; over-allocation
  // is what must never happen, BR-M1).
  const budget = settlement.escrowed - settlement.distributed
  const perWallet = budget / BigInt(qualifying.length)
  if (perWallet <= BigInt(0)) {
    throw new AllocationError(
      'The escrowed amount is too small to split among the qualifying wallets.',
    )
  }

  const entries = qualifying.map((p) => ({
    wallet: p.address.toLowerCase(),
    amount: perWallet.toString(),
    tasksCompleted: p.tasksCompleted,
  }))
  const totalAllocated = perWallet * BigInt(qualifying.length)
  if (totalAllocated > budget) {
    // Should be unreachable given floor division — hard-fail per BR-M1 rather than trust it.
    throw new AllocationError(
      'Internal reconciliation error: computed allocation exceeds escrow.',
    )
  }

  const tree = StandardMerkleTree.of(
    entries.map((e) => [e.wallet, e.amount]),
    ['address', 'uint256'],
  )
  const treeJson = tree.dump()

  // Determine the next version and supersede any prior UNPUBLISHED proposal — a published
  // tree stays PUBLISHED (and thus servable/claimable) until the host actually re-publishes
  // a *different* root, which is handled in markAllocationPublished, not here.
  const latest = await prisma.merkleTree.findFirst({
    where: { campaignId },
    orderBy: { version: 'desc' },
  })
  const version = (latest?.version ?? 0) + 1

  await prisma.merkleTree.updateMany({
    where: { campaignId, status: 'PROPOSED' },
    data: { status: 'SUPERSEDED' },
  })

  const created = await prisma.merkleTree.create({
    data: {
      campaignId,
      version,
      root: tree.root,
      token: settlement.token,
      totalAmount: totalAllocated.toString(),
      policy,
      treeJson: treeJson as object,
      status: 'PROPOSED',
      // Persisted so the host-review panel shows who was filtered out on any later load, not
      // just in the immediate propose response (BR-M3 host review of humanity exclusions).
      excludedForHumanity,
      entries: {
        create: entries.map((e, i) => ({
          campaignId,
          wallet: e.wallet,
          amount: e.amount,
          leafIndex: i,
          tasksCompleted: e.tasksCompleted,
        })),
      },
    },
  })

  // Best-effort notification (BR-N*): the proposal is ready for the host to review. Never allowed
  // to break the allocation pipeline — a notification failure must not fail a successful propose.
  if (cache?.hostAddress) {
    try {
      await notifyAllocationProposalReady({
        campaignId,
        hostAddress: cache.hostAddress,
        campaignName: cache.title,
        walletCount: entries.length,
        excludedCount: excludedForHumanity.length,
      })
    } catch (e) {
      console.warn('[allocation] proposal-ready notification failed (non-fatal):', e)
    }
  }

  return {
    campaignId,
    version: created.version,
    root: created.root,
    token: created.token,
    totalAmount: created.totalAmount,
    policy,
    entries,
    excludedForHumanity,
    reconciliation: {
      escrowed: budget.toString(),
      allocated: totalAllocated.toString(),
      withinBudget: totalAllocated <= budget,
    },
  }
}

/** Latest tree for a campaign (any status) — for the host-review screen. */
export async function getLatestAllocation(campaignId: number) {
  return prisma.merkleTree.findFirst({
    where: { campaignId },
    orderBy: { version: 'desc' },
    include: { entries: true },
  })
}

/**
 * Called by the client after `setERC20MerkleRoot` actually succeeds on-chain. Best-effort
 * bookkeeping only — the chain remains authoritative (BR-I4); the proof API cross-checks
 * against a live `getERC20Settlement` read rather than trusting `status` alone.
 */
export async function markAllocationPublished(campaignId: number, version: number) {
  const row = await prisma.merkleTree.findUnique({
    where: { campaignId_version: { campaignId, version } },
  })
  if (!row) throw new AllocationError('Allocation version not found')

  const publishedAt = new Date()
  await prisma.$transaction([
    prisma.merkleTree.updateMany({
      where: { campaignId, status: 'PUBLISHED', NOT: { version } },
      data: { status: 'SUPERSEDED' },
    }),
    prisma.merkleTree.update({
      where: { id: row.id },
      data: { status: 'PUBLISHED', publishedAt },
    }),
  ])

  // Best-effort notifications (BR-N*): a REAL lifecycle transition — the root is now published,
  // so the dispute window has started and claims open in 24h. Participants get "claims open
  // soon"; the host gets "dispute window started" (in-app + webhooks). Wrapped so a notification
  // failure never surfaces as a publish-bookkeeping error (the on-chain publish already
  // succeeded before this function is even called).
  try {
    const [entries, cache] = await Promise.all([
      prisma.allocationEntry.findMany({
        where: { merkleTreeId: row.id },
        select: { wallet: true },
      }),
      prisma.campaignCache.findFirst({ where: { campaignId } }),
    ])
    if (cache?.hostAddress) {
      await notifyAllocationsPublished({
        campaignId,
        hostAddress: cache.hostAddress,
        allocatedWallets: entries.map((e) => e.wallet),
        campaignName: cache.title,
        claimsOpenAt: new Date(publishedAt.getTime() + ROOT_DISPUTE_WINDOW_MS),
        token: row.token,
      })
    }
  } catch (e) {
    console.warn('[allocation] allocations-published notification failed (non-fatal):', e)
  }
}

export type AllocationClaimStatus =
  | 'not_allocated'
  | 'pending_publish'
  | 'dispute_window'
  | 'claimable'
  | 'claimed'
  | 'swept'

export type AllocationProof = {
  wallet: string
  amount: string
  proof: string[]
  claimableAt: number | null
  status: AllocationClaimStatus
  token: string
  /** Display-only. Amounts (amount/totalAmount everywhere) stay in on-chain base units for
   * every value-bearing use (claims, proofs, reconciliation) — decimals are only for
   * formatting on-screen, never for arithmetic. Null if the token contract couldn't be read. */
  decimals: number | null
  symbol: string | null
}

// Token decimals/symbol are immutable for a given deployed contract — safe to cache for the
// life of the server process rather than re-reading on every proof/allocation-summary request.
const tokenInfoCache = new Map<string, { decimals: number; symbol: string } | null>()
export async function getCachedTokenInfo(
  token: string,
): Promise<{ decimals: number; symbol: string } | null> {
  const key = token.toLowerCase()
  if (tokenInfoCache.has(key)) return tokenInfoCache.get(key) ?? null
  const info = await getERC20TokenInfo(token)
  tokenInfoCache.set(key, info)
  return info
}

/**
 * Proof API backing (BR-M4): resolves the tree matching the CURRENTLY PUBLISHED on-chain
 * root (never just "the latest DB row") so a stale/superseded proof is never served — that
 * would revert InvalidMerkleProof on-chain. Falls back to the latest proposed/published tree
 * (marked pending_publish) so the host-review UI can preview allocations before publishing.
 */
export async function getAllocationProof(
  campaignId: number,
  wallet: string,
): Promise<AllocationProof | null> {
  const lower = wallet.toLowerCase()
  const settlement = await getERC20SettlementOnChain(String(campaignId), lower)

  let treeRow = null as Awaited<ReturnType<typeof prisma.merkleTree.findFirst>>
  if (settlement.merkleRoot && settlement.merkleRoot !== ZERO_ROOT) {
    treeRow = await prisma.merkleTree.findFirst({
      where: { campaignId, root: settlement.merkleRoot },
    })
  }
  if (!treeRow) {
    treeRow = await prisma.merkleTree.findFirst({
      where: { campaignId, status: { in: ['PROPOSED', 'PUBLISHED'] } },
      orderBy: { version: 'desc' },
    })
  }
  if (!treeRow) return null

  const tokenInfo = await getCachedTokenInfo(treeRow.token)

  const entry = await prisma.allocationEntry.findUnique({
    where: { merkleTreeId_wallet: { merkleTreeId: treeRow.id, wallet: lower } },
  })
  if (!entry) {
    return {
      wallet: lower,
      amount: '0',
      proof: [],
      claimableAt: null,
      status: 'not_allocated',
      token: treeRow.token,
      decimals: tokenInfo?.decimals ?? null,
      symbol: tokenInfo?.symbol ?? null,
    }
  }

  const tree = StandardMerkleTree.load(
    treeRow.treeJson as unknown as Parameters<typeof StandardMerkleTree.load>[0],
  )
  const proof = tree.getProof(entry.leafIndex)

  const isCurrentlyPublishedRoot =
    settlement.merkleRoot !== ZERO_ROOT && settlement.merkleRoot === treeRow.root

  let status: AllocationClaimStatus
  if (settlement.swept) {
    status = 'swept'
  } else if (settlement.hasClaimed) {
    status = 'claimed'
  } else if (!isCurrentlyPublishedRoot) {
    status = 'pending_publish'
  } else if (Math.floor(Date.now() / 1000) < settlement.claimableAt) {
    status = 'dispute_window'
  } else {
    status = 'claimable'
  }

  return {
    wallet: lower,
    amount: entry.amount,
    proof,
    claimableAt: isCurrentlyPublishedRoot ? settlement.claimableAt : null,
    status,
    token: treeRow.token,
    decimals: tokenInfo?.decimals ?? null,
    symbol: tokenInfo?.symbol ?? null,
  }
}
