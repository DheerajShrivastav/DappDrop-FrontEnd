'use client'

import type { Campaign, UserTask, Task as TaskType } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { shortDate, shortDateTime } from '@/lib/campaign-status'
import { TASK_VERIFICATION_METHOD } from '@/lib/task-types'
import { Button, Chip, Panel, SectionHeader, Spinner, VerificationChip, plural } from '@/components/app'

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
            return (
              <li key={task.id} className="cp-row" data-task-state={u?.completed ? 'done' : u?.isCompleting ? 'checking' : err ? 'failed' : 'todo'}>
                <span className="cp-n" aria-hidden="true">
                  {n}
                </span>
                <span className="cp-what text-body font-medium text-ink">{task.description}</span>
                <span className="cp-how">
                  {method && <VerificationChip method={method} withNote />}
                  {task.isOptional && <Chip variant="neutral">Optional</Chip>}
                  {task.type === 'ONCHAIN_TX' && task.metadata?.paymentRequired && task.metadata.amountDisplay && (
                    <span className="font-mono text-[0.8125rem] text-ink-2">
                      Pay {task.metadata.amountDisplay}
                      {task.metadata.network ? ` on ${task.metadata.network}` : ''}
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
                    // Pre-existing gap: the page never had a payment dialog, so [Start] did nothing.
                    // Say so instead of offering a dead button (phase2-A-handoff.md, open issues).
                    <span className="text-[0.8125rem] text-ink-2">Can’t be done in the app yet</span>
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
