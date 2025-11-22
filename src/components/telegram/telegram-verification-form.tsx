'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, MessageCircle, HelpCircle, ExternalLink } from 'lucide-react'
import { useWallet } from '@/context/wallet-provider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TelegramVerificationFormProps {
  campaignId: string
  taskId: string
  onVerificationComplete: (
    success: boolean,
    message?: string,
    telegramData?: any
  ) => void
  isLoading?: boolean
}

export function TelegramVerificationForm({
  campaignId,
  taskId,
  onVerificationComplete,
  isLoading = false,
}: TelegramVerificationFormProps) {
  const { address } = useWallet()
  const [telegramUsername, setTelegramUsername] = useState('')
  const [telegramUserId, setTelegramUserId] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleVerification = async () => {
    if (!address) {
      setError('Please connect your wallet first')
      return
    }

    if (!telegramUserId) {
      setError('Telegram User ID is required for accurate verification')
      return
    }

    // Validate user ID format (should be numeric)
    if (!/^\d+$/.test(telegramUserId)) {
      setError('Telegram User ID must be a numeric value')
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const response = await fetch('/api/verify-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId,
          taskId,
          userAddress: address,
          telegramUsername: telegramUsername || undefined,
          telegramUserId: telegramUserId,
        }),
      })

      const result = await response.json()

      if (result.success && result.verified) {
        // Pass the telegram data back to the parent
        const telegramData = {
          username: telegramUsername || undefined,
          userId: telegramUserId,
        }

        onVerificationComplete(
          true,
          'Telegram membership verified successfully!',
          telegramData
        )
      } else {
        // Handle specific error cases with helpful messages
        let errorMessage = result.error || 'Verification failed'

        if (errorMessage.includes('Network timeout')) {
          errorMessage =
            'Network timeout: Please check your internet connection and try again.'
        } else if (errorMessage.includes('NOT a member')) {
          errorMessage = `You are not a member of the required Telegram channel. Please join first and try again.`
        } else if (errorMessage.includes('User ID is required')) {
          errorMessage =
            'Telegram User ID is required. Please get your ID from @userinfobot and try again.'
        }

        onVerificationComplete(false, errorMessage)
      }
    } catch (error) {
      console.error('Verification error:', error)

      // Handle network errors specifically
      let errorMessage = 'Failed to verify Telegram membership'
      if (error instanceof Error) {
        if (error.message.includes('fetch') || error.name === 'TypeError') {
          errorMessage =
            'Network error: Please check your internet connection and try again.'
        } else {
          errorMessage = error.message
        }
      }

      onVerificationComplete(false, errorMessage)
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <>
      {/* Main Compact Form */}
      <div className="w-full max-w-md space-y-4 p-6">
        {/* Minimal Header */}
        <div className="flex items-center gap-2 pb-2">
          <MessageCircle className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Telegram Verification</h3>
        </div>

        {/* Condensed Input Group */}
        <div className="space-y-4">
          {/* User ID Field with Inline Tooltip */}
          <div className="space-y-2">
            <Label
              htmlFor="telegram-userid"
              className="flex items-center gap-1.5 text-sm"
            >
              Telegram User ID <span className="text-destructive">*</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">
                      Your numeric Telegram ID is required for accurate
                      verification due to Telegram Bot API limitations.
                      Username-only verification is unreliable.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              id="telegram-userid"
              type="text"
              placeholder="123456789"
              value={telegramUserId}
              onChange={(e) =>
                setTelegramUserId(e.target.value.replace(/\D/g, ''))
              }
              onFocus={() => setFocusedField('userid')}
              onBlur={() => setFocusedField(null)}
              disabled={isLoading || isVerifying}
              className="font-mono"
            />
            {focusedField === 'userid' && (
              <p className="text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
                Enter your numeric Telegram user ID
              </p>
            )}
          </div>

          {/* Username Field */}
          <div className="space-y-2">
            <Label htmlFor="telegram-username" className="text-sm">
              Telegram Username{' '}
              <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <Input
              id="telegram-username"
              type="text"
              placeholder="username"
              value={telegramUsername}
              onChange={(e) =>
                setTelegramUsername(e.target.value.replace('@', ''))
              }
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
              disabled={isLoading || isVerifying}
            />
            {focusedField === 'username' && (
              <p className="text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-200">
                Without @ symbol
              </p>
            )}
          </div>
        </div>

        {/* Help Link - Replaces Entire Instructions Section */}
        <button
          onClick={() => setShowHelpModal(true)}
          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          <HelpCircle className="h-3 w-3" />
          Where do I find my User ID?
        </button>

        {/* Compact Error Display */}
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State - Minimal */}
        {isVerifying && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Verifying membership...</span>
          </div>
        )}

        {/* Primary Action Button */}
        <Button
          onClick={handleVerification}
          disabled={isLoading || isVerifying || !telegramUserId}
          className="w-full bg-blue-600 hover:bg-blue-700 h-10 font-medium"
          size="lg"
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify Membership'
          )}
        </Button>
      </div>

      {/* Help Modal - Separate from Main Form */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-500" />
              How to Find Your Telegram User ID
            </DialogTitle>
            <DialogDescription>
              Use any of these methods to get your numeric user ID
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs">
                  1
                </span>
                Using @userinfobot
              </h4>
              <p className="text-sm text-muted-foreground pl-7">
                Open Telegram and search for{' '}
                <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">
                  @userinfobot
                </code>
                . Send any message or forward a message to get your ID.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs">
                  2
                </span>
                Using @getmyid_bot
              </h4>
              <p className="text-sm text-muted-foreground pl-7">
                Search for{' '}
                <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">
                  @getmyid_bot
                </code>{' '}
                and start a chat to receive your user ID instantly.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
              <p className="text-xs text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Your User ID is a numeric value (e.g.,
                123456789). It's different from your username.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowHelpModal(false)}
              className="flex-1"
            >
              Got it
            </Button>
            <Button
              onClick={() => {
                window.open('https://t.me/userinfobot', '_blank')
                setShowHelpModal(false)
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Bot
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
