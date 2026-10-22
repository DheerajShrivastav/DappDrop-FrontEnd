'use client'

import type { Campaign, UserTask, Task as TaskType } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { shortDate, shortDateTime } from '@/lib/campaign-status'
import { TASK_VERIFICATION_METHOD } from '@/lib/task-types'
import { DEPLOYMENT_CHAIN, deploymentChainFor } from '@/lib/deployment-chain'
import { paymentRequestFromTask } from '@/lib/payment-request'
import { Button, Spinner } from '@/components/app/button'
import { Chip, VerificationChip } from '@/components/app/chip'
import { Panel } from '@/components/app/panel'
import { SectionHeader } from '@/components/app/page-header'
import { plural } from '@/components/app/format'

/**
 * "Your tasks" (§1.8 / §2.2): numbered hairline rows: 01 · what to do · how it's checked · the
 * state on the right. States: To do [Start] · Checking… · ✓ Done (self-reported tasks keep their
 * dashed chip) · ! Couldn't verify: <reason> [Try again].
 *
 * Fixes from the audit (§2.2 "bug fixes the build must include"):
 * - task actions for ANY connected wallet, not only `role === 'participant'` (a wallet with the
 *   host role can take part in someone else's campaign);
 * - "Campaign full" from the campaign's real cap (`settlement.maxParticipants`, 0 = no cap), not
 *   a hard-coded 1,000, and only for wallets that haven't joined yet (a joined wallet keeps going).
 */
export function TaskList({
  campaign,
  status,
  userTasks,
  taskErrors,
  isConnected,
  isJoined,
  onConnect,
  onStart,
}: {
  campaign: Campaign
  status: CampaignStatusInfo
  userTasks: UserTask[]
  /** The last verification failure per task id, in plain words. */
  taskErrors: Record<string, string>
  isConnected: boolean
  isJoined: boolean
  onConnect: () => void
  onStart: (taskId: string, type: TaskType['type']) => void
}) {
  const tasks = campaign.tasks
  const done = tasks.filter((t) => userTasks.find((u) => u.taskId === t.id)?.completed).length
  const cap = campaign.settlement?.maxParticipants ?? 0
  const full = cap > 0 && campaign.participants >= cap && !isJoined
  const accepting = status.acceptingTasks && campaign.status === 'Open'
  const canAct = isConnected && accepting && !full

  // One line under the list for every reason the rows are read-only (never a silent no-op).
  const closedNote =
    status.state === 'draft'
      ? 'Tasks open when the host opens the campaign.'
      : status.state === 'upcoming'
        ? `Tasks open ${shortDateTime(new Date(campaign.startDate))}.`
        : status.state === 'cancelled'
          ? 'This campaign was cancelled, so its tasks are closed.'
          : !accepting
            ? `Tasks closed when the campaign ended on ${shortDate(new Date(campaign.endDate))}.`
            : full
              ? `This campaign is full (${cap.toLocaleString('en-US')} of ${cap.toLocaleString('en-US')}).`
              : null

  return (
    <section aria-labelledby="cp-tasks">
      <SectionHeader
        id="cp-tasks"
        title={isConnected ? 'Your tasks' : 'Tasks'}
        note={isConnected && tasks.length > 0 ? `${done} of ${tasks.length} done` : plural(tasks.length, 'task')}
      />

      {!isConnected && accepting && !full && (
        <Panel tone="sunk" pad={false} className="mt-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4" data-connect-bar="">
          <p className="text-body text-ink">Connect your wallet to take part.</p>
          <Button size="sm" onClick={onConnect}>
            Connect wallet
          </Button>
        </Panel>
      )}

      {tasks.length === 0 ? (
        <p className="border-b border-rule py-5 text-small text-ink-2">This campaign has no tasks.</p>
      ) : (
        <ol className="cp-rows">
          {tasks.map((task, i) => {
            const n = String(i + 1).padStart(2, '0')
            const u = userTasks.find((x) => x.taskId === task.id)
            const method = TASK_VERIFICATION_METHOD[task.type]
            const err = taskErrors[task.id]
            const payment = paymentRequestFromTask(task, DEPLOYMENT_CHAIN.id)
            return (
              <li key={task.id} className="cp-row" data-task-state={u?.completed ? 'done' : u?.isCompleting ? 'checking' : err ? 'failed' : 'todo'}>
                <span className="cp-n" aria-hidden="true">
                  {n}
                </span>
                <span className="cp-what text-body font-medium text-ink">{task.description}</span>
                <span className="cp-how">
                  {method && <VerificationChip method={method} withNote />}
                  {task.isOptional && <Chip variant="neutral">Optional</Chip>}
                  {payment && (
                    // The real charge (amount + token), not the host's free-text display line.
                    <span className="font-mono text-[0.8125rem] text-ink-2">
                      Pay {payment.amountDisplay} on {deploymentChainFor(payment.chainId).name}
                    </span>
                  )}
                </span>
                <span className="cp-state">
                  {u?.completed ? (
                    <span className="cp-done">Done</span>
                  ) : u?.isCompleting ? (
                    <span className="inline-flex items-center gap-2 font-mono text-[0.8125rem] text-ink-2" role="status">
                      <Spinner /> Checking…
                    </span>
                  ) : err && canAct ? (
                    <span className="grid justify-items-end gap-2 max-sm:justify-items-start">
                      <span className="text-small text-ink-2">
                        <span aria-hidden="true" className="mr-1 font-mono font-semibold text-danger">
                          !
                        </span>
                        Couldn’t verify: {err}
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => onStart(task.id, task.type)} aria-label={`Try again: ${task.description}`}>
                        Try again
                      </Button>
                    </span>
                  ) : canAct && task.type === 'ONCHAIN_TX' ? (
                    // Opens the payment dialog (payment-task-dialog.tsx).
                    <Button size="sm" variant="secondary" onClick={() => onStart(task.id, task.type)} aria-label={`Pay: ${task.description}`}>
                      Pay
                    </Button>
                  ) : canAct ? (
                    <Button size="sm" variant="secondary" onClick={() => onStart(task.id, task.type)} aria-label={`Start: ${task.description}`}>
                      Start
                    </Button>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {closedNote && <p className="mt-[0.9rem] text-[0.8125rem] text-ink-2">{closedNote}</p>}
    </section>
  )
}
