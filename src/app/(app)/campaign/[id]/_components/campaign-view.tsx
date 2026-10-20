'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { Campaign, UserTask, Task as TaskType } from '@/lib/types'
import { getCampaignStatus } from '@/lib/campaign-status'
import { Button } from '@/components/app/button'
import { PageContainer } from '@/components/app/page-header'
import { CampaignHeader } from './campaign-header'
import { LifecycleRibbon } from './lifecycle-ribbon'
import { ClaimSection } from './claim-section'
import { TaskList } from './task-list'
import { RewardListSection } from './reward-list-section'
import { TieredLeaderboard } from './tiered-leaderboard'
import { ReportConcernDialog } from './report-concern-dialog'
import { CampaignFacts, HostRail } from './campaign-rail'
import { HostBar, HostSteps } from './host-steps'
import { hostPlan, isTieredMode } from './campaign-model'

export type CampaignViewProps = {
  campaign: Campaign
  /** Pin the clock (dev fixtures); live pages tick every 30 s so the 24 h / 30 d windows roll over. */
  now?: Date
  address: string | null
  isConnected: boolean
  /** The connected wallet hosts THIS campaign. */
  isHost: boolean
  userTasks: UserTask[]
  taskErrors: Record<string, string>
  isJoined: boolean
  onConnect: () => void
  onStartTask: (taskId: string, type: TaskType['type']) => void
  onRecordEnd: () => void
  isRecordingEnd: boolean
  onCopyLink: () => void
  onRefresh: () => void
  isRefreshing: boolean
  onStatusChange: () => void
  /** Host analytics behind "More numbers". */
  moreNumbers?: ReactNode
  /** Fixture pages: an "Example" chip, and a pre-built claim panel for wallet-only states. */
  extraChips?: ReactNode
  claimOverride?: ReactNode
}

/**
 * The campaign page body (app-design §2.2 participant, §2.3 host), shared by the live page and the
 * dev fixtures. Participant order: header → ribbon → claim panel (when relevant) → tasks → the
 * reward list; the rail holds the facts. Host order: header → ribbon → host bar → "Your next
 * steps"; the rail holds participation. A host can switch to the participant view and back.
 */
export function CampaignView(p: CampaignViewProps) {
  const { campaign } = p
  const [tick, setTick] = useState(() => p.now ?? new Date())
  const [asParticipant, setAsParticipant] = useState(false)

  useEffect(() => {
    if (p.now) return
    const t = setInterval(() => setTick(new Date()), 30_000)
    return () => clearInterval(t)
  }, [p.now])

  const now = p.now ?? tick
  const status = getCampaignStatus(campaign, now)
  const hostView = p.isHost && !asParticipant
  const tiered = isTieredMode(campaign.settlement?.mode)
  const report = <ReportConcernDialog campaignId={campaign.id} isConnected={p.isConnected} />

  const hostToggle = p.isHost ? (
    <button type="button" className="dd-link inline-flex min-h-11 cursor-pointer items-center bg-transparent p-0 font-sans text-small" onClick={() => setAsParticipant((v) => !v)}>
      {hostView ? 'View as a participant' : 'Back to your host view'}
    </button>
  ) : undefined

  // "Record the end": any connected wallet, once the end time has passed (permissionless).
  const recordEnd =
    status.state === 'ended_unrecorded' && p.isConnected && !hostView ? (
      <Button size="sm" variant="secondary" onClick={p.onRecordEnd} loading={p.isRecordingEnd}>
        {p.isRecordingEnd ? 'Recording…' : 'Record the end'}
      </Button>
    ) : undefined

  return (
    <PageContainer className="cp pt-4 md:pt-6">
      <CampaignHeader campaign={campaign} status={status} hostView={hostView} extraChips={p.extraChips} hostToggle={hostToggle} />
      <LifecycleRibbon campaign={campaign} status={status} action={recordEnd} />

      {hostView ? (
        <>
          <HostBar needsYou={hostPlan(campaign, status).needsYou} />
          <div className="cp-grid">
            <div className="cp-main">
              <HostSteps
                campaign={campaign}
                status={status}
                onRecordEnd={p.onRecordEnd}
                isRecordingEnd={p.isRecordingEnd}
                onStatusChange={p.onStatusChange}
                moreNumbers={p.moreNumbers}
              />
            </div>
            <aside className="cp-rail" aria-label="Campaign numbers">
              <HostRail campaign={campaign} status={status} />
              <Button variant="secondary" size="sm" block onClick={p.onCopyLink}>
                Copy campaign link
              </Button>
            </aside>
          </div>
        </>
      ) : (
        <div className="cp-grid">
          <div className="cp-main">
            {p.claimOverride ?? (
              <ClaimSection
                campaign={campaign}
                status={status}
                address={p.address}
                isConnected={p.isConnected}
                isJoined={p.isJoined}
                userTasks={p.userTasks}
                onConnect={p.onConnect}
                report={report}
              />
            )}
            <TaskList
              campaign={campaign}
              status={status}
              userTasks={p.userTasks}
              taskErrors={p.taskErrors}
              isConnected={p.isConnected}
              isJoined={p.isJoined}
              onConnect={p.onConnect}
              onStart={p.onStartTask}
            />
            {tiered ? <TieredLeaderboard campaign={campaign} /> : <RewardListSection campaign={campaign} status={status} report={report} />}
          </div>
          <aside className="cp-rail" aria-label="Campaign facts">
            <CampaignFacts campaign={campaign} status={status} onCopyLink={p.onCopyLink} onRefresh={p.onRefresh} isRefreshing={p.isRefreshing} />
          </aside>
        </div>
      )}
    </PageContainer>
  )
}
