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
import { MessageSquare, Loader2 } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { TaskType } from '@/lib/types'

interface TaskVerificationFormProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
  taskType: TaskType
  campaignId: string
  onVerify: (
    taskId: string,
    taskType: TaskType,
    socialData?: any
  ) => Promise<void>
}

export function TaskVerificationForm({
  isOpen,
  onOpenChange,
  taskId,
  taskType,
  campaignId,
  onVerify,
}: TaskVerificationFormProps) {
  const [discordUserData, setDiscordUserData] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [storedVerification, setStoredVerification] = useState<any>(null)

  // Load any previously stored verification data and reset state when dialog opens/closes
  useEffect(() => {
    if (typeof window !== 'undefined' && taskId && campaignId && isOpen) {
      // When dialog opens, check for stored verification
      const storedData = localStorage.getItem(
        `discord_verification_${campaignId}_${taskId}`
      )
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData)
          setStoredVerification(parsedData)
        } catch (e) {
          console.error('Error parsing stored verification:', e)
        }
      }
    }

    // Reset state when dialog closes
    if (!isOpen) {
      setIsConnecting(false)
      setConnectionError(null)
      // Keep discordUserData and storedVerification as they may be needed when reopening
    }
  }, [taskId, campaignId, isOpen])

  const handleVerification = async () => {
    if (!taskId) return

    setIsVerifying(true)
    try {
      await onVerify(taskId, taskType, discordUserData)

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

      // Add cases for other task types here

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
