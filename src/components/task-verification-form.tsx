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
import { DiscordAuthButton } from '@/components/discord-auth-button'
import { TelegramVerificationForm } from '@/components/telegram/telegram-verification-form'
import { MessageSquare, Loader2, ExternalLink } from 'lucide-react'
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
  onVerify: (
    taskId: string,
    taskType: TaskType,
    discordData?: any,
    telegramData?: any
  ) => Promise<void>
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
  const [discordUserData, setDiscordUserData] = useState<any>(null)
  const [telegramUserData, setTelegramUserData] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [storedVerification, setStoredVerification] = useState<any>(null)

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

  // Load any previously stored verification data and reset state when dialog opens/closes
  useEffect(() => {
    if (typeof window !== 'undefined' && taskId && campaignId && isOpen) {
      // When dialog opens, check for stored Discord verification
      const storedData = localStorage.getItem(
        `discord_verification_${campaignId}_${taskId}`
      )
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData)
          setStoredVerification(parsedData)
        } catch (e) {
          console.error('Error parsing stored Discord verification:', e)
        }
      }

      // When dialog opens, check for stored Telegram verification
      const storedTelegramData = localStorage.getItem(
        `telegram_verification_${campaignId}_${taskId}`
      )
      if (storedTelegramData) {
        try {
          const parsedTelegramData = JSON.parse(storedTelegramData)
          if (parsedTelegramData.verified) {
            setTelegramUserData({
              username: parsedTelegramData.username,
              userId: parsedTelegramData.userId,
            })
          }
        } catch (e) {
          console.error('Error parsing stored Telegram verification:', e)
        }
      }
    }

    // Reset state when dialog closes
    if (!isOpen) {
      setIsConnecting(false)
      setConnectionError(null)
      // Keep discordUserData, telegramUserData and storedVerification as they may be needed when reopening
    }
  }, [taskId, campaignId, isOpen])

  const handleVerification = async () => {
    if (!taskId) return

    setIsVerifying(true)
    try {
      await onVerify(taskId, taskType, discordUserData, telegramUserData)

      // Store verification data for future reference
      if (discordUserData && taskType === 'JOIN_DISCORD') {
        localStorage.setItem(
          `discord_verification_${campaignId}_${taskId}`,
          JSON.stringify({
            username: discordUserData.username,
            id: discordUserData.id,
            verified: true,
            timestamp: new Date().toISOString(),
          })
        )
      }

      if (telegramUserData && taskType === 'JOIN_TELEGRAM') {
        localStorage.setItem(
          `telegram_verification_${campaignId}_${taskId}`,
          JSON.stringify({
            username: telegramUserData.username,
            userId: telegramUserData.userId,
            verified: true,
            timestamp: new Date().toISOString(),
          })
        )
      }
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
        return (
          <>
            <DialogHeader>
              <DialogTitle>Verify Discord Task</DialogTitle>
              <DialogDescription>
                Please connect your Discord account to verify that you've joined
                the server.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6 space-y-4">
              {/* Show error message if there was an error */}
              {connectionError && (
                <Alert variant="destructive" className="w-full mb-2">
                  <AlertTitle>Connection Error</AlertTitle>
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}

              {storedVerification?.verified && (
                <Alert className="bg-green-500/10 border-green-500 w-full mb-4">
                  <AlertTitle className="text-green-600">
                    Previously Verified
                  </AlertTitle>
                  <AlertDescription className="text-sm space-y-1">
                    <p>You've already verified this task with:</p>
                    <p>
                      <strong>Username:</strong> {storedVerification.username}
                    </p>
                    {storedVerification.id && (
                      <p>
                        <strong>Discord ID:</strong> {storedVerification.id}
                      </p>
                    )}
                    <p>
                      <strong>Verified:</strong>{' '}
                      {new Date(storedVerification.timestamp).toLocaleString()}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleVerification}
                    >
                      Verify Again
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {!discordUserData ? (
                <div className="flex flex-col items-center space-y-4 w-full">
                  {isConnecting ? (
                    <div className="flex flex-col items-center p-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Connecting to Discord...
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Please complete authentication in the popup window
                      </p>
                    </div>
                  ) : (
                    <DiscordAuthButton
                      onSuccess={(userData) => {
                        console.log('Discord auth success:', userData)
                        setDiscordUserData(userData)
                        setIsConnecting(false)
                        setConnectionError(null)
                      }}
                      onError={(error) => {
                        console.error('Discord connection failed:', error)
                        setIsConnecting(false)
                        setConnectionError(
                          error.message ||
                            'Failed to connect to Discord. Please try again.'
                        )
                      }}
                      // Set connecting state when the button is clicked
                      beforeAuth={() => {
                        setIsConnecting(true)
                        setConnectionError(null)
                      }}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3 p-4 bg-secondary/30 rounded-lg w-full">
                  <div className="text-lg font-medium flex items-center">
                    <MessageSquare className="mr-2 h-5 w-5 text-[#5865F2]" />
                    {discordUserData.username}
                    {discordUserData.discriminator && (
                      <span className="text-muted-foreground">
                        #{discordUserData.discriminator}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Discord account connected
                  </p>
                  <div className="text-xs bg-secondary p-2 rounded-md w-full mt-2">
                    <p>
                      <strong>Username:</strong> {discordUserData.username}
                    </p>
                    <p>
                      <strong>User ID:</strong> {discordUserData.id}
                    </p>
                    {discordUserData.email && (
                      <p>
                        <strong>Email:</strong> {discordUserData.email}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDiscordUserData(null)}
                  >
                    Change Account
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                onClick={handleVerification}
                disabled={!discordUserData || isVerifying}
              >
                {isVerifying && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm & Verify
              </Button>
            </DialogFooter>
          </>
        )

      case 'JOIN_TELEGRAM':
        return (
          <>
            <DialogHeader>
              <DialogTitle>Verify Telegram Task</DialogTitle>
              <DialogDescription>
                Please provide your Telegram information to verify that you've
                joined the channel or group.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              {/* Show error message if there was an error */}
              {connectionError && (
                <Alert variant="destructive" className="w-full mb-2">
                  <AlertTitle>Verification Error</AlertTitle>
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}

              {telegramUserData && (
                <Alert className="bg-green-500/10 border-green-500 w-full mb-4">
                  <AlertTitle className="text-green-600">
                    Previously Verified
                  </AlertTitle>
                  <AlertDescription className="text-sm space-y-1">
                    <p>You've already verified this task with:</p>
                    <p>
                      <strong>Username:</strong> {telegramUserData.username}
                    </p>
                    {telegramUserData.userId && (
                      <p>
                        <strong>User ID:</strong> {telegramUserData.userId}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleVerification}
                      disabled={isVerifying}
                    >
                      Use Previous Verification
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 ml-2"
                      onClick={() => setTelegramUserData(null)}
                    >
                      Verify Again
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {!telegramUserData && (
                <TelegramVerificationForm
                  campaignId={campaignId}
                  taskId={taskId || ''}
                  onVerificationComplete={(success, message, telegramData) => {
                    if (success && telegramData) {
                      // Store the telegram data and trigger verification
                      setTelegramUserData(telegramData)
                      // Call the parent's onVerify function
                      handleVerification()
                    } else {
                      setConnectionError(message || 'Verification failed')
                    }
                  }}
                  isLoading={isVerifying}
                />
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )

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
