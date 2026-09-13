import 'server-only'

import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import { prisma } from './prisma'
import {
  getCampaignByIdWithMetadata,
  getCampaignParticipants,
  getPinnedNFTModule,
  getNFTSettlementOnChain,
  isNFTLeafClaimedOnChain,
} from './web3-service'
import { isHumanityVerifiedDurable } from './humanity-service'
import { AllocationError, type AllocationClaimStatus } from './allocation'

const ZERO_ROOT = '0x' + '00'.repeat(32)

/**
 * NFT Merkle allocation pipeline (P3 CP2) — reuses the same host-review → host-publishes flow,
 * MerkleTree/AllocationEntry models, humanity-gating filter, and 24h dispute window as the
 * ERC20 pipeline (src/lib/allocation.ts), per the standing "extend, don't duplicate"
 * instruction. Only two things differ, both because NFTs are discrete items, not a divisible
 * pool: the leaf encoding (verified byte-exact against NFTSettlementModule.sol — see the
 * comment on the tree construction below) and the allocation POLICY.
 *
 * Default policy (PRD "smallest reasonable default" — no NFT equivalent of Q3 exists yet, so
 * this is the analogous default): ONE_PER_WALLET_ROUND_ROBIN. Qualifying wallets (same
 * task-completion + humanity-gating rule as ERC20) are sorted by wallet address for a
 * deterministic, re-proposal-stable order, then deposited items (src/lib/... NFTDeposit rows,
 * tracked off-chain because the contract exposes no enumerable "every tokenId ever deposited"
 * view) are handed out one-per-wallet in deposit order until either wallets or items run out.
 * If there are more qualifying wallets than deposited items, the excess wallets get NO
 * allocation this round — flagged in the proposal response so the host can deposit more and
 * re-propose. Splitting a single ERC1155 tokenId's balance across multiple winners, or
 * assigning multiple distinct items to one wallet, are both out of scope for this default and
 * flagged as follow-ups.
 */

export type ProposedNFTAllocation = {
  campaignId: number
  version: number
  root: string
  tokenAddress: string
  totalItems: number
  policy: string
  entries: {
    wallet: string
    standard: 'ERC721' | 'ERC1155'
    tokenId: string
    amount: string
    tasksCompleted: number
  }[]
  excludedForHumanity: string[]
  unallocatedQualifyingWallets: string[] // qualified but no item left to assign
}

export async function proposeNFTAllocation(campaignId: number): Promise<ProposedNFTAllocation> {
  const campaign = await getCampaignByIdWithMetadata(String(campaignId))
  if (!campaign) throw new AllocationError('Campaign not found')
  if (campaign.status !== 'Ended' && campaign.status !== 'Closed') {
    throw new AllocationError('Allocations can only be proposed once the campaign has Ended.')
  }

  const cache = await prisma.campaignCache.findFirst({ where: { campaignId } })
  const humanityGated = cache?.humanityGated ?? false

  const moduleAddress = await getPinnedNFTModule(String(campaignId))
  if (!moduleAddress) {
    throw new AllocationError('This campaign has no NFT deposits — nothing to allocate.')
  }

  const deposits = await prisma.nFTDeposit.findMany({
    where: { campaignId, allocated: false },
    orderBy: { createdAt: 'asc' },
  })
  if (deposits.length === 0) {
    throw new AllocationError('No unallocated NFT deposits for this campaign.')
  }
  const tokenAddress = deposits[0].tokenAddress

  const totalTasks = campaign.tasks.length
  if (totalTasks === 0) {
    throw new AllocationError('This campaign has no tasks to qualify against.')
  }

  const participants = await getCampaignParticipants(campaign)
  let qualifying = participants.filter((p) => p.tasksCompleted >= totalTasks)

  const excludedForHumanity: string[] = []
  if (humanityGated) {
    const checked = await Promise.all(
      qualifying.map(async (p) => ({ p, verified: await isHumanityVerifiedDurable(p.address) })),
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
        (humanityGated ? ' (none completed every task and are Humanity-verified).' : ' (none completed every task).'),
    )
  }

  // Deterministic order (address sort) so re-proposing without new deposits/participants
  // reproduces the same assignment — never re-derive from a non-deterministic source.
  qualifying = [...qualifying].sort((a, b) => a.address.localeCompare(b.address))

  const assignedCount = Math.min(qualifying.length, deposits.length)
  const entries = qualifying.slice(0, assignedCount).map((p, i) => {
    const d = deposits[i]
    return {
      wallet: p.address.toLowerCase(),
      standard: d.standard as 'ERC721' | 'ERC1155',
      tokenId: d.tokenId,
      amount: d.amount,
      tasksCompleted: p.tasksCompleted,
    }
  })
  const unallocatedQualifyingWallets = qualifying.slice(assignedCount).map((p) => p.address.toLowerCase())

  const tree = StandardMerkleTree.of(
    entries.map((e) => [
      e.wallet,
      e.standard === 'ERC721' ? 0 : 1, // CampaignStorage.NFTStandard — verified against the enum in CampaignStorage.sol
      tokenAddress,
      e.tokenId,
      e.amount,
    ]),
    // Byte-exact match to NFTSettlementModule.sol's leaf:
    // keccak256(bytes.concat(keccak256(abi.encode(account, uint8(standard), token, tokenId, amount))))
    ['address', 'uint8', 'address', 'uint256', 'uint256'],
  )
  const treeJson = tree.dump()

  const latest = await prisma.merkleTree.findFirst({ where: { campaignId }, orderBy: { version: 'desc' } })
  const version = (latest?.version ?? 0) + 1

  await prisma.merkleTree.updateMany({
    where: { campaignId, status: 'PROPOSED' },
    data: { status: 'SUPERSEDED' },
  })

  await prisma.$transaction(async (tx) => {
    const created = await tx.merkleTree.create({
      data: {
        campaignId,
        version,
        root: tree.root,
        token: tokenAddress,
        totalAmount: String(entries.length),
        policy: 'ONE_PER_WALLET_ROUND_ROBIN',
        rewardKind: 'NFT',
        treeJson: treeJson as object,
        status: 'PROPOSED',
        excludedForHumanity,
        entries: {
          create: entries.map((e, i) => ({
            campaignId,
            wallet: e.wallet,
            amount: e.amount,
            leafIndex: i,
            tasksCompleted: e.tasksCompleted,
            nftStandard: e.standard,
            tokenId: e.tokenId,
          })),
        },
      },
    })
    // Mark the consumed deposits so a later re-proposal (without new deposits) doesn't hand
    // the same item to a different wallet than a still-pending PROPOSED tree already promised.
    await tx.nFTDeposit.updateMany({
      where: { id: { in: deposits.slice(0, assignedCount).map((d) => d.id) } },
      data: { allocated: true },
    })
    return created
  })

  return {
    campaignId,
    version,
    root: tree.root,
    tokenAddress,
    totalItems: entries.length,
    policy: 'ONE_PER_WALLET_ROUND_ROBIN',
    entries,
    excludedForHumanity,
    unallocatedQualifyingWallets,
  }
}

/** Latest NFT tree for a campaign (any status) — for the host-review screen. */
export async function getLatestNFTAllocation(campaignId: number) {
  return prisma.merkleTree.findFirst({
    where: { campaignId, rewardKind: 'NFT' },
    orderBy: { version: 'desc' },
    include: { entries: true },
  })
}

/** P4 — NFT counterpart of getPublishedAllocation (allocation.ts): the tree matching the
 * CURRENTLY PUBLISHED on-chain root, or null if nothing is live yet. See that function's
 * docstring for why this is the only tree ever served to an unauthenticated caller. */
export async function getPublishedNFTAllocation(campaignId: number) {
  const onChain = await getNFTSettlementOnChain(String(campaignId))
  if (!onChain || !onChain.merkleRoot || onChain.merkleRoot === ZERO_ROOT) return null
  return prisma.merkleTree.findFirst({
    where: { campaignId, root: onChain.merkleRoot, rewardKind: 'NFT' },
    include: { entries: true },
  })
}

export async function markNFTAllocationPublished(campaignId: number, version: number) {
  const row = await prisma.merkleTree.findUnique({ where: { campaignId_version: { campaignId, version } } })
  if (!row) throw new AllocationError('Allocation version not found')
  await prisma.$transaction([
    prisma.merkleTree.updateMany({
      where: { campaignId, status: 'PUBLISHED', NOT: { version } },
      data: { status: 'SUPERSEDED' },
    }),
    prisma.merkleTree.update({
      where: { id: row.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    }),
  ])
}

export type NFTAllocationProof = {
  wallet: string
  standard: 'ERC721' | 'ERC1155' | null
  tokenAddress: string
  tokenId: string | null
  amount: string
  proof: string[]
  claimableAt: number | null
  status: AllocationClaimStatus
}

/**
 * Proof lookup for the NFT claim UI — mirrors getAllocationProof (allocation.ts) but resolves
 * claimability against getNFTClaimableAt/isNFTLeafClaimed on the campaign's PINNED NFT module
 * instead of the ERC20 settlement view. BR-I4: value-bearing status is re-verified against a
 * direct RPC read here, never trusted from the DB tree status alone.
 */
export async function getNFTAllocationProof(
  campaignId: number,
  wallet: string,
): Promise<NFTAllocationProof | null> {
  const lower = wallet.toLowerCase()
  const onChain = await getNFTSettlementOnChain(String(campaignId))

  let treeRow: Awaited<ReturnType<typeof prisma.merkleTree.findFirst>> = null
  if (onChain && onChain.merkleRoot && onChain.merkleRoot !== ZERO_ROOT) {
    treeRow = await prisma.merkleTree.findFirst({
      where: { campaignId, root: onChain.merkleRoot, rewardKind: 'NFT' },
    })
  }
  if (!treeRow) {
    treeRow = await prisma.merkleTree.findFirst({
      where: { campaignId, rewardKind: 'NFT', status: { in: ['PROPOSED', 'PUBLISHED'] } },
      orderBy: { version: 'desc' },
    })
  }
  if (!treeRow) return null

  const entry = await prisma.allocationEntry.findUnique({
    where: { merkleTreeId_wallet: { merkleTreeId: treeRow.id, wallet: lower } },
  })
  if (!entry) {
    return {
      wallet: lower,
      standard: null,
      tokenAddress: treeRow.token,
      tokenId: null,
      amount: '0',
      proof: [],
      claimableAt: null,
      status: 'not_allocated',
    }
  }

  const tree = StandardMerkleTree.load(
    treeRow.treeJson as unknown as Parameters<typeof StandardMerkleTree.load>[0],
  )
  const proof = tree.getProof(entry.leafIndex)

  const isCurrentlyPublishedRoot = Boolean(onChain) && onChain!.merkleRoot === treeRow.root

  let status: AllocationClaimStatus = 'pending_publish'
  if (isCurrentlyPublishedRoot && onChain) {
    // Same leaf the tree itself would produce for this entry — re-derived here (not read back
    // off the tree dump) so it's provably the byte-exact encoding NFTSettlementModule.sol hashes.
    const leaf = tree.leafHash([
      entry.wallet,
      entry.nftStandard === 'ERC721' ? 0 : 1,
      treeRow.token,
      entry.tokenId,
      entry.amount,
    ] as never)
    const hasClaimed = await isNFTLeafClaimedOnChain(onChain.moduleAddress, String(campaignId), leaf)
    if (hasClaimed) {
      status = 'claimed'
    } else if (Math.floor(Date.now() / 1000) < onChain.claimableAt) {
      status = 'dispute_window'
    } else {
      status = 'claimable'
    }
  }

  return {
    wallet: lower,
    standard: entry.nftStandard as 'ERC721' | 'ERC1155' | null,
    tokenAddress: treeRow.token,
    tokenId: entry.tokenId,
    amount: entry.amount,
    proof,
    claimableAt: isCurrentlyPublishedRoot ? onChain!.claimableAt : null,
    status,
  }
}
