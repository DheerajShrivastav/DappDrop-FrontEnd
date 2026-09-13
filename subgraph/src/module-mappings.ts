// Handlers for the per-campaign pinned satellite modules, spawned as data-source templates
// from RewardModulePinned / NFTModulePinned (Decision 3, NFR-2). Each event carries the
// campaignId, so we link straight back to the Campaign entity; the module ADDRESS is never
// assumed statically — it is whatever instance was pinned to that campaign.

import {
  RankTiersConfigured,
  ScoreTiersConfigured,
  TaskPointsSet,
} from '../generated/templates/OnChainRewardModule/OnChainRewardModule'
import {
  NFTMerkleRootSet,
  NFTRewardClaimed,
  UnclaimedNFTsWithdrawn,
  FallbackRootPublished as NFTFallbackRootPublished,
} from '../generated/templates/NFTSettlementModule/NFTSettlementModule'
import { Campaign, Claim } from '../generated/schema'

// ---------------------------------------------------------------------------
// OnChainRewardModule (tiered settlement)
// ---------------------------------------------------------------------------

export function handleRankTiersConfigured(event: RankTiersConfigured): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.settlementMode = 'RANK_TIERED'
  c.tierCount = event.params.tierCount.toI32()
  c.save()
}

export function handleScoreTiersConfigured(event: ScoreTiersConfigured): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.settlementMode = 'SCORE_TIERED'
  c.tierCount = event.params.tierCount.toI32()
  c.save()
}

export function handleTaskPointsSet(event: TaskPointsSet): void {
  // Points configuration affects SCORE_TIERED payout math; no discovery-facing field to set
  // at P0 beyond confirming the campaign has a pinned reward module (already recorded on pin).
}

// ---------------------------------------------------------------------------
// NFTSettlementModule (NFT Merkle settlement)
// ---------------------------------------------------------------------------

export function handleNFTMerkleRootSet(event: NFTMerkleRootSet): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.settlementMode = 'NFT'
  const prev = c.nftMerkleRoot
  let changed = true
  if (prev !== null) {
    changed = !prev.equals(event.params.merkleRoot)
  }
  if (changed) {
    c.nftRootPublishedAt = event.block.timestamp
  }
  c.nftMerkleRoot = event.params.merkleRoot
  c.save()
}

export function handleNFTRewardClaimed(event: NFTRewardClaimed): void {
  const campaignId = event.params.campaignId.toString()
  const id = campaignId
    .concat('-NFT-')
    .concat(event.params.account.toHexString())
    .concat('-')
    .concat(event.params.tokenId.toString())
  const claim = new Claim(id)
  claim.campaign = campaignId
  claim.account = event.params.account
  claim.kind = 'NFT'
  claim.amount = event.params.amount
  claim.tokenStandard = event.params.standard
  claim.token = event.params.token
  claim.tokenId = event.params.tokenId
  claim.claimedAt = event.block.timestamp
  claim.claimedAtBlock = event.block.number
  claim.txHash = event.transaction.hash
  claim.save()
}

export function handleUnclaimedNFTsWithdrawn(
  event: UnclaimedNFTsWithdrawn,
): void {
  // Host swept unclaimed NFTs after grace. No discovery-facing aggregate tracked at P0
  // (per-token escrow accounting is a host-analytics concern for P3).
}

export function handleNFTFallbackRootPublished(
  event: NFTFallbackRootPublished,
): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.fallbackRootPublished = true
  c.save()
}
