'use client'

import { useWatch } from 'react-hook-form'
import { Button } from '@/components/app/button'
import { VerificationChip } from '@/components/app/chip'
import { TASK_VERIFICATION_METHOD } from '@/lib/task-types'
import type { TaskType } from '@/lib/types'
import { taskTypeLabel, type CampaignFormValues } from './campaign-form'

/** "01", "02"…: a task's number in the wizard. */
export const num = (i: number) => String(i + 1).padStart(2, '0')

/**
 * A finished task, collapsed (mockup wizard.html): its number, what participants do, how it's
 * checked, and [Edit].
 */
export function TaskSummaryRow({ index, onEdit }: { index: number; onEdit: () => void }) {
  const task = useWatch<CampaignFormValues, `tasks.${number}`>({ name: `tasks.${index}` })
  const type = task?.type as TaskType
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3 border-t border-rule px-5 py-4 first:border-t-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto]" data-task-row={index}>
      <span className="pt-0.5 font-mono text-[0.8125rem] text-ink-3">{num(index)}</span>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <p className="font-medium text-ink [overflow-wrap:anywhere]">
          {task?.description}
          {task?.isOptional && <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-3">(optional)</span>}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-ink-2">{taskTypeLabel(type)}</span>
          {type && <VerificationChip method={TASK_VERIFICATION_METHOD[type]} withNote />}
        </span>
      </div>
      <Button size="sm" variant="secondary" className="col-start-2 justify-self-start sm:col-start-3" onClick={onEdit} aria-label={`Edit task ${index + 1}`}>
        Edit
      </Button>
    </div>
  )
}
