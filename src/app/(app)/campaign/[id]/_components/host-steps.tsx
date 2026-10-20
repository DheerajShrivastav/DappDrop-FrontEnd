'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { Campaign } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { hasEndTimePassed, EXPIRED_OPEN_WARNING } from '@/lib/campaign-timing'
import { claims } from '@/config/claims'
import { cancelCampaignOnChain, getCloseOptions, mapContractRevertToMessage, openCampaign } from '@/lib/web3-service'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Button, ConfirmDialog, Panel, SectionHeader } from '@/components/app'
import { hostPlan, isTieredMode, type HostStep } from './campaign-model'
import { MerkleSettlementPanel } from './merkle-settlement-panel'
import { NFTSettlementPanel } from './nft-settlement-panel'
import { CloseCampaignAction, ReportsList, useHostReports } from './dispute-reports-panel'

const CLOSE_GUARD_REASON = 'Publish the reward list first: closing without one would leave nobody able to claim.'

/** The host bar (§2.3): "You host this campaign." + the one thing that needs them, in words. */
export function HostBar({ needsYou }: { needsYou: string }) {
  return (
    <Panel tone="sunk" pad={false} className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-[0.9rem]" data-host-bar="">
      <p className="text-small text-ink">
        <strong className="font-semibold">You host this campaign.</strong> <span className="text-ink-2">{needsYou}</span>
      </p>
      <span className="font-mono text-[0.8125rem] text-ink-2">Only you see this panel</span>
    </Panel>
  )
}

function StepRow({ step, n, action, body }: { step: HostStep; n: number; action?: ReactNode; body?: ReactNode }) {
  return (
    <li className={cn('cp-row cp-step', `is-${step.state}`)} aria-current={step.state === 'now' ? 'step' : undefined} data-step={step.key}>
      <span className="cp-n" aria-hidden="true">
        {String(n).padStart(2, '0')}
      </span>
      <span className="cp-what">
        {step.title}
        {step.state === 'now' && <span className="sr-only"> (the current step)</span>}
      </span>
      <span className="cp-how">{step.detail}</span>
      <span className="cp-state">
        {step.state === 'past' ? (
          <span className="cp-done">
            {step.date ? (
              <>
                <span className="sr-only">Done </span>
                {step.date}
              </>
            ) : (
              'Done'
            )}
          </span>
        ) : (
          action
        )}
      </span>
      {body && <div className="cp-body">{body}</div>}
    </li>
  )
}

/** A done step's tool, folded away (the list or the reports stay reachable after their step). */
function Fold({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="cp-details">
      <summary>
        <span className="dd-link text-small">{summary}</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

/**
 * "Your next steps" (§2.3): the host's 7-step checklist (5 for ranked / by points) wrapping the
 * existing host panels: open · record the end · propose → check → publish the list · the 24-hour
 * review with the reports · close · take back what's left. There's no "End" button before the
 * end time (APP-08): an open campaign ends on schedule.
 */
export function HostSteps({
  campaign,
  status,
  onRecordEnd,
  isRecordingEnd,
  onStatusChange,
  moreNumbers,
}: {
  campaign: Campaign
  status: CampaignStatusInfo
  onRecordEnd: () => void
  isRecordingEnd: boolean
  onStatusChange: () => void
  /** The deeper analytics, behind "More numbers". */
  moreNumbers?: ReactNode
}) {
  const { toast } = useToast()
  const plan = hostPlan(campaign, status)
  const tiered = isTieredMode(campaign.settlement?.mode)
  const ended = campaign.status === 'Ended'
  const listPublished = ['allocations_published', 'claims_open', 'closed_claimable', 'swept'].includes(status.state)
  const reports = useHostReports(campaign.id, !tiered && ended)
  const [opening, setOpening] = useState(false)
  const [openConfirm, setOpenConfirm] = useState(false)
  const [canCancelEarly, setCanCancelEarly] = useState(false)

  // Before anyone joins, a host can cancel for an immediate refund. Ask the chain (a staticCall of
  // cancelCampaign from the host's signer), so the button only shows when it would go through.
  const emptyOpen = campaign.status === 'Open' && campaign.participants === 0
  useEffect(() => {
    if (!emptyOpen) return
    let cancelled = false
    getCloseOptions(campaign.id)
      .then((o) => !cancelled && setCanCancelEarly(o.canCancel))
      .catch(() => !cancelled && setCanCancelEarly(false))
    return () => {
      cancelled = true
    }
  }, [emptyOpen, campaign.id])

  const handleOpen = async () => {
    setOpening(true)
    try {
      if (campaign.status !== 'Draft') {
        toast({ variant: 'destructive', title: 'Already open', description: 'This campaign is already open.' })
        return
      }
      // openCampaign reports its own success / failure toasts.
      const resultId = await openCampaign(campaign.id, toast)
      if (resultId !== campaign.id) {
        window.location.href = `/campaign/${resultId}`
        return
      }
      onStatusChange()
    } catch {
      // The error toast is shown by the service.
    } finally {
      setOpening(false)
    }
  }

  const handleCancel = async () => {
    try {
      const txHash = await cancelCampaignOnChain(campaign.id)
      const nft = campaign.settlement?.mode === 'NFT' || campaign.reward.type === 'ERC721'
      toast({ title: 'Campaign cancelled', description: nft ? `Your NFTs can be withdrawn now. Tx: ${txHash}` : `The reward went back to your wallet. Tx: ${txHash}` })
      onStatusChange()
    } catch (e) {
      toast({ variant: 'destructive', title: 'The campaign wasn’t cancelled', description: mapContractRevertToMessage(e) })
    }
  }

  if (status.state === 'cancelled') {
    return (
      <section aria-labelledby="cp-steps">
        <SectionHeader id="cp-steps" title="Your next steps" />
        <p className="border-b border-rule py-5 text-small text-ink-2">Nothing left to do: the campaign was cancelled and its reward went back to you.</p>
      </section>
    )
  }

  const settlement = campaign.settlement?.mode === 'NFT' ? <NFTSettlementPanel campaign={campaign} /> : <MerkleSettlementPanel campaign={campaign} />
  // TODO(redeploy): with the contract update the chain itself rejects this close (OUT-C03,
  // `SettlementNotPublished`); `claims.hostCloseGuarded` keeps the UI guard in step with it.
  const closeBlocked = claims.hostCloseGuarded && plan.closeBlocked

  const render = (step: HostStep): { action?: ReactNode; body?: ReactNode } => {
    switch (step.key) {
      case 'opened':
        if (step.state !== 'now') return {}
        return {
          action: (
            <Button size="sm" onClick={() => setOpenConfirm(true)} loading={opening}>
              {opening ? 'Opening…' : 'Open campaign'}
            </Button>
          ),
        }
      case 'ended':
        if (status.state === 'ended_unrecorded')
          return {
            action: (
              <Button size="sm" onClick={onRecordEnd} loading={isRecordingEnd}>
                {isRecordingEnd ? 'Recording…' : 'Record the end'}
              </Button>
            ),
          }
        if (emptyOpen && canCancelEarly)
          return {
            body: (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="text-small text-ink-2">Nobody has joined yet. You can cancel for an immediate refund.</p>
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="secondary">
                      Cancel campaign
                    </Button>
                  }
                  title="Cancel this campaign?"
                  body="Nobody has joined, so the reward comes back to you now. You can’t undo this or reopen the campaign."
                  confirmLabel="Cancel campaign"
                  cancelLabel="Not now"
                  destructive
                  onConfirm={handleCancel}
                />
              </div>
            ),
          }
        return {}
      case 'list':
        if (campaign.status !== 'Ended' && campaign.status !== 'Closed') return {}
        return { body: step.state === 'now' ? settlement : <Fold summary="Check or correct the list">{settlement}</Fold> }
      case 'review':
        if (!ended || !listPublished) return {}
        return {
          body:
            step.state === 'now' ? (
              <ReportsList campaignId={campaign.id} data={reports} />
            ) : (
              <Fold summary={reports.openCount > 0 ? `Reports on the list (${reports.openCount} open)` : 'Reports on the list'}>
                <ReportsList campaignId={campaign.id} data={reports} />
              </Fold>
            ),
        }
      case 'close':
        if (!ended) return {}
        return {
          action: (
            <CloseCampaignAction
              campaign={campaign}
              openReports={reports.openCount}
              primary={step.state === 'now'}
              blockedReason={closeBlocked ? CLOSE_GUARD_REASON : undefined}
              onStatusChange={onStatusChange}
            />
          ),
        }
      default:
        return {}
    }
  }

  return (
    <section aria-labelledby="cp-steps">
      <SectionHeader id="cp-steps" title="Your next steps" note={plan.currentIndex ? `Step ${plan.currentIndex} of ${plan.steps.length}` : 'All done'} />
      <ol className="cp-rows">
        {plan.steps.map((step, i) => {
          const { action, body } = render(step)
          return <StepRow key={step.key} step={step} n={i + 1} action={action} body={body} />
        })}
      </ol>

      {moreNumbers && (
        <details className="cp-details mt-6">
          <summary>
            <span className="dd-link text-small">More numbers</span>
          </summary>
          <div className="mt-4 grid gap-6">{moreNumbers}</div>
        </details>
      )}

      <ConfirmDialog
        open={openConfirm}
        onOpenChange={setOpenConfirm}
        title="Open this campaign?"
        body={
          <>
            <p>Participants can join straight away. You can’t move the end time later.</p>
            {/* openCampaign has no on-chain timing check, so an expired draft opens fine and is
                immediately endable by anyone. Say so before the host signs. */}
            {hasEndTimePassed(campaign.endDate) && (
              <p className="font-semibold text-ink">
                <span aria-hidden="true" className="mr-1.5 font-mono text-signal">
                  !
                </span>
                {EXPIRED_OPEN_WARNING}
              </p>
            )}
          </>
        }
        confirmLabel="Open campaign"
        onConfirm={handleOpen}
      />
    </section>
  )
}
