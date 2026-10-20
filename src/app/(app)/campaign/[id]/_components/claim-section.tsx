'use client'

import type { ReactNode } from 'react'
import type { Campaign, UserTask } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { shortDate } from '@/lib/campaign-status'
import { isTieredMode } from './campaign-model'
import { RewardPanel } from './reward-panel'
import { ClaimPanel } from './claim-panel'
import { NFTClaimPanel } from './nft-claim-panel'
import { TieredClaimPanel } from './tiered-claim-panel'

const LIST_WAITING = new Set(['ended_finalizing', 'overdue_fallback'])
const LIST_PUBLISHED = new Set(['allocations_published', 'claims_open', 'closed_claimable', 'swept'])

/** The deadline line under the claim buttons (§1.9). */
export function deadlineLine(status: CampaignStatusInfo): ReactNode {
  if (status.state === 'closed_claimable' && status.sweepEligibleAt)
    return (
      <>
        <strong className="font-semibold text-ink">Claim by {shortDate(status.sweepEligibleAt)}.</strong> After that, the host can take back what’s unclaimed.
      </>
    )
  if (status.state === 'claims_open')
    return (
      <>
        <strong className="font-semibold text-ink">No deadline yet.</strong> Once the host closes the campaign, you’ll have 30 days to claim.
      </>
    )
  return null
}

/**
 * Which claim panel this wallet sees (§2.2): none while the campaign runs; the connect state for a
 * visitor once rewards are in play; "the host publishes the list next" for a wallet that joined;
 * then the mode's own panel (reward list ERC20, NFT, or ranked / by points).
 */
export function ClaimSection({
  campaign,
  status,
  address,
  isConnected,
  isJoined,
  userTasks,
  onConnect,
  report,
}: {
  campaign: Campaign
  status: CampaignStatusInfo
  address: string | null
  isConnected: boolean
  isJoined: boolean
  userTasks: UserTask[]
  onConnect: () => void
  report?: ReactNode
}) {
  const mode = campaign.settlement?.mode
  const tiered = isTieredMode(mode)
  const s = status.state
  const relevant = tiered
    ? (campaign.status === 'Ended' || campaign.status === 'Closed') && s !== 'closed_no_claimants'
    : LIST_WAITING.has(s) || LIST_PUBLISHED.has(s)
  if (!relevant) return null

  if (!isConnected || !address) return <RewardPanel view={{ kind: 'connect' }} onConnect={onConnect} />

  const deadline = deadlineLine(status)
  if (tiered) return <TieredClaimPanel campaign={campaign} status={status} address={address} deadline={deadline} />

  if (LIST_WAITING.has(s)) {
    if (!isJoined) return null
    const required = campaign.tasks.filter((t) => !t.isOptional)
    const tasksDone = required.length > 0 && required.every((t) => userTasks.find((u) => u.taskId === t.id)?.completed)
    return <RewardPanel view={{ kind: 'waiting-list', tasksDone }} />
  }

  return mode === 'NFT' ? (
    <NFTClaimPanel campaign={campaign} status={status} address={address} deadline={deadline} report={report} />
  ) : (
    <ClaimPanel campaign={campaign} status={status} address={address} deadline={deadline} report={report} />
  )
}
