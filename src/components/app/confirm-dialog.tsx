'use client'

import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { buttonClass } from './button'

/**
 * The confirm modal (app-design §1.13), on the re-skinned shadcn AlertDialog: a surface card, a
 * serif 28 px title that asks the question, a body that says what happens and what can't be
 * undone, and [Not now] [**Verb**]. Never "Continue", never "Error".
 *
 *   <ConfirmDialog
 *     trigger={<Button variant="secondary">Cancel campaign</Button>}
 *     title="Cancel this campaign?"
 *     body="Nobody has joined, so the full reward goes back to your wallet. You can't reopen it."
 *     confirmLabel="Cancel campaign"
 *     destructive
 *     onConfirm={cancel}
 *   />
 *
 * `destructive` makes the confirm button the red outline (the only place `danger` is used).
 * Controlled (`open` / `onOpenChange`) or uncontrolled with a `trigger`.
 */
export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Not now',
  destructive = false,
  onConfirm,
}: {
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: ReactNode
  body: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-2">{typeof body === 'string' ? <p>{body}</p> : body}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={buttonClass({ variant: 'secondary' })}>{cancelLabel}</AlertDialogCancel>
          {/* Closes on confirm; the result is reported by a toast (✓, or ! in red if it fails). */}
          <AlertDialogAction className={buttonClass({ variant: destructive ? 'danger' : 'primary' })} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
