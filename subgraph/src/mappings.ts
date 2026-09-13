import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  CampaignCreated,
  CampaignStatusUpdated,
  CampaignCancelled,
  MaxParticipantsUpdated,
  TaskAddedToCampaign,
  ParticipantTaskCompleted,
  TaskVerifiedWithSignature,
  ERC20RewardConfigured,
  CampaignFundedERC20,
  ProtocolFeeCollected,
  ERC20MerkleRootSet,
  ERC20RewardClaimed,
  ERC20RewardClaimedOnChain,
  UnclaimedERC20Swept,
  NFTRewardsDeposited,
  OffChainRewardConfigured,
  FallbackRootPublished,
  FallbackClosed,
  RewardModulePinned,
  NFTModulePinned,
} from '../generated/Web3Campaigns/Web3Campaigns'
import {
  OnChainRewardModule as OnChainRewardModuleTemplate,
  NFTSettlementModule as NFTSettlementModuleTemplate,
} from '../generated/templates'
import {
  Campaign,
  Task,
  Participation,
  TaskCompletion,
  Claim,
} from '../generated/schema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadOrInitParticipation(
  campaignId: string,
  participant: Bytes,
  ts: BigInt,
): Participation {
  const id = campaignId.concat('-').concat(participant.toHexString())
  let p = Participation.load(id)
  if (p == null) {
    p = new Participation(id)
    p.campaign = campaignId
    p.participant = participant
    p.tasksCompleted = 0
    p.firstInteractionAt = ts
    p.lastInteractionAt = ts
  }
  return p
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function handleCampaignCreated(event: CampaignCreated): void {
  const id = event.params.campaignId.toString()
  const c = new Campaign(id)
  c.host = event.params.host
  c.name = event.params.name
  c.startTime = event.params.startTime
  c.endTime = event.params.endTime
  c.status = 0 // Draft
  c.totalParticipants = 0
  c.maxParticipants = BigInt.zero()
  c.createdAt = event.block.timestamp
  c.createdAtBlock = event.block.number
  c.settlementMode = 'UNSET'
  c.erc20EscrowedNet = BigInt.zero()
  c.erc20FeePaid = BigInt.zero()
  c.erc20Swept = false
  c.fallbackRootPublished = false
  c.fallbackClosed = false
  c.save()
}

export function handleCampaignStatusUpdated(event: CampaignStatusUpdated): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.status = event.params.newStatus
  if (event.params.newStatus == 3) {
    // Closed — start the 30-day unclaimed-sweep grace clock (NFR-9 / FR-C6).
    c.closedAt = event.block.timestamp
  }
  c.save()
}

export function handleCampaignCancelled(event: CampaignCancelled): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.status = 4 // Cancelled
  c.cancelledAt = event.block.timestamp
  c.refundedERC20 = event.params.refundedERC20
  c.save()
}

export function handleMaxParticipantsUpdated(
  event: MaxParticipantsUpdated,
): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.maxParticipants = event.params.maxParticipants
  c.save()
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function handleTaskAddedToCampaign(event: TaskAddedToCampaign): void {
  const id = event.params.campaignId
    .toString()
    .concat('-')
    .concat(event.params.taskId.toString())
  let task = Task.load(id)
  if (task == null) {
    task = new Task(id)
    task.campaign = event.params.campaignId.toString()
    task.taskId = event.params.taskId
  }
  task.taskType = event.params.taskType
  task.description = event.params.description
  task.addedAtBlock = event.block.number
  task.save()
}

// ---------------------------------------------------------------------------
// Participation / completion
//
// ParticipantTaskCompleted is the universal "task became complete" signal — it fires for
// self-verify completeTask AND for every completed=true attestation. It is therefore the
// authoritative driver of the tasksCompleted counter. TaskVerifiedWithSignature carries the
// attestation version and is the ONLY signal for a completed=false revocation, so it owns
// the true->false transition (and never double-counts the false->true one).
// ---------------------------------------------------------------------------

export function handleParticipantTaskCompleted(
  event: ParticipantTaskCompleted,
): void {
  const campaignId = event.params.campaignId.toString()
  const participationId = campaignId
    .concat('-')
    .concat(event.params.participant.toHexString())
  const wasNew = Participation.load(participationId) == null
  const p = loadOrInitParticipation(
    campaignId,
    event.params.participant,
    event.block.timestamp,
  )
  p.lastInteractionAt = event.block.timestamp

  const completionId = p.id.concat('-').concat(event.params.taskId.toString())
  let comp = TaskCompletion.load(completionId)
  let becameComplete = true
  if (comp == null) {
    comp = new TaskCompletion(completionId)
    comp.participation = p.id
    comp.campaign = campaignId
    comp.taskId = event.params.taskId
  } else {
    becameComplete = !comp.completed
  }
  comp.completed = true
  comp.completedAt = event.block.timestamp
  comp.completedAtBlock = event.block.number
  comp.save()

  if (becameComplete) {
    p.tasksCompleted = p.tasksCompleted + 1
  }
  p.save()

  // Bump campaign participant count on a wallet's first counted completion. (Kept in sync
  // with the contract's own totalParticipants++, which fires under the same condition.)
  if (wasNew) {
    const c = Campaign.load(campaignId)
    if (c != null) {
      c.totalParticipants = c.totalParticipants + 1
      c.save()
    }
  }
}

export function handleTaskVerifiedWithSignature(
  event: TaskVerifiedWithSignature,
): void {
  const campaignId = event.params.campaignId.toString()
  const p = loadOrInitParticipation(
    campaignId,
    event.params.participant,
    event.block.timestamp,
  )
  p.lastInteractionAt = event.block.timestamp
  p.save()

  const completionId = p.id.concat('-').concat(event.params.taskIndex.toString())
  let comp = TaskCompletion.load(completionId)
  if (comp == null) {
    comp = new TaskCompletion(completionId)
    comp.participation = p.id
    comp.campaign = campaignId
    comp.taskId = event.params.taskIndex
    comp.completed = false
    comp.completedAt = event.block.timestamp
    comp.completedAtBlock = event.block.number
  }
  comp.method = 'ATTESTATION'
  comp.attestationVersion = event.params.version

  // Only handle the revocation (true -> false) here; the false -> true transition and the
  // counter are owned by handleParticipantTaskCompleted (fires in the same tx for true).
  if (!event.params.completed && comp.completed) {
    comp.completed = false
    const reloaded = Participation.load(p.id)
    if (reloaded != null && reloaded.tasksCompleted > 0) {
      reloaded.tasksCompleted = reloaded.tasksCompleted - 1
      reloaded.save()
    }
  }
  comp.save()
}

// ---------------------------------------------------------------------------
// ERC20 reward config / funding / settlement
// ---------------------------------------------------------------------------

export function handleERC20RewardConfigured(
  event: ERC20RewardConfigured,
): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.erc20Token = event.params.token
  c.save()
}

export function handleCampaignFundedERC20(event: CampaignFundedERC20): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  // Event reports the NET escrowed amount (fee already skimmed).
  c.erc20EscrowedNet = c.erc20EscrowedNet.plus(event.params.amount)
  c.save()
}

export function handleProtocolFeeCollected(event: ProtocolFeeCollected): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.erc20FeePaid = c.erc20FeePaid.plus(event.params.feeAmount)
  c.save()
}

export function handleERC20MerkleRootSet(event: ERC20MerkleRootSet): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.settlementMode = 'MERKLE_ERC20'
  // Dispute-window rearm: only reset the anchor when the root VALUE actually changed;
  // a byte-identical republish does not rearm (matches the contract).
  const prev = c.erc20MerkleRoot
  let changed = true
  if (prev !== null) {
    changed = !prev.equals(event.params.merkleRoot)
  }
  if (changed) {
    c.erc20RootPublishedAt = event.block.timestamp
  }
  c.erc20MerkleRoot = event.params.merkleRoot
  c.save()
}

export function handleERC20RewardClaimed(event: ERC20RewardClaimed): void {
  const campaignId = event.params.campaignId.toString()
  const id = campaignId
    .concat('-ERC20_MERKLE-')
    .concat(event.params.account.toHexString())
  const claim = new Claim(id)
  claim.campaign = campaignId
  claim.account = event.params.account
  claim.kind = 'ERC20_MERKLE'
  claim.amount = event.params.amount
  claim.claimedAt = event.block.timestamp
  claim.claimedAtBlock = event.block.number
  claim.txHash = event.transaction.hash
  claim.save()
}

export function handleERC20RewardClaimedOnChain(
  event: ERC20RewardClaimedOnChain,
): void {
  const campaignId = event.params.campaignId.toString()
  const id = campaignId
    .concat('-ERC20_TIERED-')
    .concat(event.params.account.toHexString())
  const claim = new Claim(id)
  claim.campaign = campaignId
  claim.account = event.params.account
  claim.kind = 'ERC20_TIERED'
  claim.amount = event.params.amount
  claim.rankOrScore = event.params.rankOrScore
  claim.claimedAt = event.block.timestamp
  claim.claimedAtBlock = event.block.number
  claim.txHash = event.transaction.hash
  claim.save()
}

export function handleUnclaimedERC20Swept(event: UnclaimedERC20Swept): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.erc20Swept = true
  c.erc20SweptAt = event.block.timestamp
  c.save()
}

// ---------------------------------------------------------------------------
// NFT deposits (custody on entrypoint) + off-chain reward
// ---------------------------------------------------------------------------

export function handleNFTRewardsDeposited(event: NFTRewardsDeposited): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  if (c.settlementMode == 'UNSET') c.settlementMode = 'NFT'
  c.save()
}

export function handleOffChainRewardConfigured(
  event: OffChainRewardConfigured,
): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.offChainRewardDescription = event.params.description
  c.save()
}

// ---------------------------------------------------------------------------
// SETTLER_ROLE fallback (NFR-11) — ERC20 path emits these on the entrypoint
// ---------------------------------------------------------------------------

export function handleFallbackRootPublished(
  event: FallbackRootPublished,
): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.fallbackRootPublished = true
  c.save()
}

export function handleFallbackClosed(event: FallbackClosed): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c == null) return
  c.fallbackClosed = true
  c.save()
}

// ---------------------------------------------------------------------------
// Module pins — spawn per-campaign satellite templates (Decision 3, NFR-2)
// ---------------------------------------------------------------------------

export function handleRewardModulePinned(event: RewardModulePinned): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c != null) {
    c.rewardModule = event.params.module
    c.save()
  }
  // Index THIS campaign's pinned OnChainRewardModule instance from here on.
  OnChainRewardModuleTemplate.create(event.params.module)
}

export function handleNFTModulePinned(event: NFTModulePinned): void {
  const c = Campaign.load(event.params.campaignId.toString())
  if (c != null) {
    c.nftModule = event.params.module
    if (c.settlementMode == 'UNSET') c.settlementMode = 'NFT'
    c.save()
  }
  NFTSettlementModuleTemplate.create(event.params.module)
}
