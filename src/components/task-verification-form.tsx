'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { LinkedAccountPanel } from '@/components/linked-account-panel'
import { Loader2, ExternalLink } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import type { Task, TaskType } from '@/lib/types'
import { parseXTarget, xIntentFor } from '@/lib/x-intents'

interface TaskVerificationFormProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
  taskType: TaskType
  campaignId: string
  /** The task being verified — used for the X link on self-reported tasks. */
  task?: Task | null
  /** No identity data: the server checks the account linked to the signed-in wallet. */
  onVerify: (taskId: string, taskType: TaskType) => Promise<void>
}

export function TaskVerificationForm({
  isOpen,
  onOpenChange,
  taskId,
  taskType,
  campaignId,
  task,
  onVerify,
}: TaskVerificationFormProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  // Discord / Telegram: Verify unlocks once an account is linked to this wallet server-side.
  const [accountLinked, setAccountLinked] = useState(false)
  useEffect(() => {
    if (!isOpen) setConnectionError(null)
  }, [isOpen])

  // Self-reported tasks: "I've completed this" unlocks only after the participant has opened the
  // task on X, plus a few seconds. This is FRICTION, NOT SECURITY — it's client-side, trivially
  // bypassed, and the backend still attests self-reported tasks on the participant's word. It
  // just stops the reflexive "click confirm without doing anything" path. Kept per task in
  // sessionStorage so closing and reopening the dialog doesn't reset it.
  const xClickKey = taskId ? `x_task_opened_${campaignId}_${taskId}` : null
  const [xOpenedAt, setXOpenedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isOpen || !xClickKey) return
    try {
      const v = sessionStorage.getItem(xClickKey)
      setXOpenedAt(v ? Number(v) : null)
    } catch {
      setXOpenedAt(null)
    }
  }, [isOpen, xClickKey])
  useEffect(() => {
    if (!isOpen || xOpenedAt === null) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [isOpen, xOpenedAt])
  const markXOpened = () => {
    const t = Date.now()
    setXOpenedAt((prev) => prev ?? t)
    setNow(t)
    try {
      if (xClickKey && !sessionStorage.getItem(xClickKey)) sessionStorage.setItem(xClickKey, String(t))
    } catch {
      // storage unavailable (private mode): the in-memory state still gates this dialog
    }
  }
  const X_GATE_MS = 5_000
  const gateRemaining = xOpenedAt === null ? null : Math.max(0, X_GATE_MS - (now - xOpenedAt))


  const handleVerification = async () => {
    if (!taskId) return

    setIsVerifying(true)
    try {
      // No identity data is passed: the server uses the account linked to the signed-in wallet.
      await onVerify(taskId, taskType)
    } catch (error) {
      console.error('Verification error:', error)
    } finally {
      setIsVerifying(false)
      onOpenChange(false)
    }
  }

  const renderVerificationForm = () => {
    switch (taskType) {
      case 'JOIN_DISCORD':
      case 'JOIN_TELEGRAM': {
        const isDiscord = taskType === 'JOIN_DISCORD'
        return (
          <>
            <DialogHeader>
              <DialogTitle>{isDiscord ? 'Verify Discord Task' : 'Verify Telegram Task'}</DialogTitle>
              <DialogDescription>
                {isDiscord
                  ? 'Join the server, then connect your Discord account so we can check you are a member.'
                  : 'Join the channel or group, then sign in with Telegram so we can check you are a member.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {task?.description && <p className="text-sm">{task.description}</p>}
              <LinkedAccountPanel
                key={taskType}
                platform={isDiscord ? 'discord' : 'telegram'}
                onLinkedChange={setAccountLinked}
              />
              {connectionError && (
                <Alert variant="destructive">
                  <AlertTitle>Verification Error</AlertTitle>
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isVerifying}>
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={handleVerification} disabled={!accountLinked || isVerifying}>
                {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify membership
              </Button>
            </DialogFooter>
          </>
        )
      }

      // WALLET_CONNECT: the signed-in wallet session is the proof (verify-task attests it with
      // method 'siwe-session' for the session wallet only) — a real check, so no X gate.
      case 'WALLET_CONNECT':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Verify Wallet Connection</DialogTitle>
              <DialogDescription>
                Your signed-in wallet is the proof. Confirm to record it for this task.
              </DialogDescription>
            </DialogHeader>
            {connectionError && (
              <Alert variant="destructive">
                <AlertTitle>Verification Error</AlertTitle>
                <AlertDescription>{connectionError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isVerifying}>
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={handleVerification} disabled={isVerifying}>
                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm
              </Button>
            </DialogFooter>
          </>
        )

      // Self-reported task types (no automatic X check yet): the backend attests these for the
      // signed-in wallet on the participant's word, recorded as 'self-reported' in the audit log.
      case 'SOCIAL_FOLLOW':
      case 'SOCIAL_LIKE':
      case 'SOCIAL_POST':
      case 'RETWEET': {
        const copy: Record<string, { title: string; instruction: string }> = {
          SOCIAL_FOLLOW: { title: 'Follow on X', instruction: 'Follow the account on X, then come back and confirm.' },
          SOCIAL_LIKE: { title: 'Like on X', instruction: 'Like the post on X, then come back and confirm.' },
          SOCIAL_POST: { title: 'Post on X', instruction: 'Publish the post described below on X, then come back and confirm.' },
          RETWEET: { title: 'Repost on X', instruction: 'Repost the post on X, then come back and confirm.' },
        }
        const { title, instruction } = copy[taskType]
        // Only validated handles / numeric post ids ever reach the link (see x-intents.ts).
        const intent = xIntentFor(taskType, parseXTarget(task?.verificationData, task?.description))
        const unlocked = gateRemaining === 0
        return (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{instruction}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {task?.description && <p className="text-sm">{task.description}</p>}
              <Button asChild variant="outline" className="w-full">
                <a href={intent.href} target="_blank" rel="noopener noreferrer" onClick={markXOpened}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {intent.label}
                </a>
              </Button>
              {connectionError && (
                <Alert variant="destructive">
                  <AlertTitle>Verification Error</AlertTitle>
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}
              <p className="text-center text-xs text-muted-foreground">
                This task is self-reported — it can&apos;t be checked automatically yet. Only confirm
                once you&apos;ve actually done it.
              </p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isVerifying}>
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={handleVerification} disabled={isVerifying || !unlocked}>
                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {gateRemaining === null
                  ? 'Open X first'
                  : unlocked
                    ? "I've done it"
                    : `I've done it (${Math.ceil(gateRemaining / 1000)}s)`}
              </Button>
            </DialogFooter>
          </>
        )
      }

      default:
        return (
          <div className="p-6 text-center">
            <p>Verification not available for this task type.</p>
          </div>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {renderVerificationForm()}
      </DialogContent>
    </Dialog>
  )
}
