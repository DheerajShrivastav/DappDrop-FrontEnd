'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EXPIRED_OPEN_WARNING } from '@/lib/campaign-timing'

/**
 * Confirm step before opening a Draft whose end time has already passed, for the wizard's
 * go-live step (which has no confirm dialog of its own). The campaign page and campaign card
 * already confirm every open, so they render the same EXPIRED_OPEN_WARNING inside that dialog
 * instead of stacking a second one. Opening stays the host's call — this informs, it doesn't block.
 */
export function OpenExpiredCampaignDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Open a campaign that has already ended?</AlertDialogTitle>
          <AlertDialogDescription>{EXPIRED_OPEN_WARNING}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Don’t open</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Open anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
