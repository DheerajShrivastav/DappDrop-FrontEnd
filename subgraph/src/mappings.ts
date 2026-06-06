import { BigInt, Bytes } from '@graphprotocol/graph-ts'

import {
  CampaignCreated,
  CampaignStatusUpdated,
  TaskAddedToCampaign,
  ParticipantTaskCompleted,
  RewardSet,
  RewardClaimed,
} from '../generated/Web3Campaigns/Web3Campaigns'

import {
  Campaign,
  Task,
  Participation,
  TaskCompletion,
} from '../generated/schema'

// ---------------------------------------------------------------------------
// CampaignCreated
// ---------------------------------------------------------------------------
export function handleCampaignCreated(event: CampaignCreated): void {
  const id = event.params.campaignId.toString()

  let campaign = new Campaign(id)
  campaign.host = event.params.host
  campaign.name = event.params.name
  campaign.startTime = event.params.startTime
  campaign.endTime = event.params.endTime
  campaign.status = 0 // Draft
  campaign.totalParticipants = 0
  campaign.createdAt = event.block.timestamp
  campaign.createdAtBlock = event.block.number
  campaign.rewardType = null
  campaign.rewardTokenAddress = null
  campaign.rewardAmountOrTokenId = null
  campaign.save()
}

// ---------------------------------------------------------------------------
// CampaignStatusUpdated
// ---------------------------------------------------------------------------
export function handleCampaignStatusUpdated(
  event: CampaignStatusUpdated,
): void {
  const id = event.params.campaignId.toString()
  let campaign = Campaign.load(id)
  if (campaign == null) return

  campaign.status = event.params.newStatus
  campaign.save()
}

// ---------------------------------------------------------------------------
// TaskAddedToCampaign
// ---------------------------------------------------------------------------
export function handleTaskAddedToCampaign(event: TaskAddedToCampaign): void {
  const taskId = event.params.campaignId
    .toString()
    .concat('-')
    .concat(event.params.taskId.toString())

  let task = new Task(taskId)
  task.campaign = event.params.campaignId.toString()
  task.taskId = event.params.taskId
  task.taskType = event.params.taskType
  task.description = event.params.description
  task.addedAtBlock = event.block.number
  task.save()
}

// ---------------------------------------------------------------------------
// ParticipantTaskCompleted
// ---------------------------------------------------------------------------
export function handleParticipantTaskCompleted(
  event: ParticipantTaskCompleted,
): void {
  const campaignId = event.params.campaignId.toString()
  const participantHex = event.params.participant.toHexString()
  const participationId = campaignId.concat('-').concat(participantHex)

  // Load or create Participation
  let participation = Participation.load(participationId)
  const isNew = participation == null

  if (participation == null) {
    participation = new Participation(participationId)
    participation.campaign = campaignId
    participation.participant = event.params.participant
    participation.hasClaimedReward = false
    participation.tasksCompleted = 0
    participation.firstInteractionAt = event.block.timestamp
    participation.lastInteractionAt = event.block.timestamp
  }

  participation.tasksCompleted = participation.tasksCompleted + 1
  participation.lastInteractionAt = event.block.timestamp
  participation.save()

  // Increment campaign participant count only on first task completion
  if (isNew) {
    let campaign = Campaign.load(campaignId)
    if (campaign != null) {
      campaign.totalParticipants = campaign.totalParticipants + 1
      campaign.save()
    }
  }

  // Create TaskCompletion record
  const completionId = participationId
    .concat('-')
    .concat(event.params.taskId.toString())
  let completion = TaskCompletion.load(completionId)
  if (completion == null) {
    completion = new TaskCompletion(completionId)
    completion.participation = participationId
    completion.campaign = campaignId
    completion.taskId = event.params.taskId
    completion.completedAt = event.block.timestamp
    completion.completedAtBlock = event.block.number
    completion.save()
  }
}

// ---------------------------------------------------------------------------
// RewardSet
// ---------------------------------------------------------------------------
export function handleRewardSet(event: RewardSet): void {
  const id = event.params.campaignId.toString()
  let campaign = Campaign.load(id)
  if (campaign == null) return

  campaign.rewardType = event.params.rewardType
  campaign.rewardTokenAddress = event.params.tokenAddress
  campaign.rewardAmountOrTokenId = event.params.amountOrTokenId
  campaign.save()
}

// ---------------------------------------------------------------------------
// RewardClaimed
// ---------------------------------------------------------------------------
export function handleRewardClaimed(event: RewardClaimed): void {
  const campaignId = event.params.campaignId.toString()
  const participantHex = event.params.participant.toHexString()
  const participationId = campaignId.concat('-').concat(participantHex)

  let participation = Participation.load(participationId)
  if (participation == null) return

  participation.hasClaimedReward = true
  participation.save()
}
