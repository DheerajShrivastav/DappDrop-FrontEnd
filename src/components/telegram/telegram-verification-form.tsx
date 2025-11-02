'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, MessageCircle, Info } from 'lucide-react'
import { useWallet } from '@/context/wallet-provider'

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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-500" />
          Telegram Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You need to be a member of the Telegram channel/group to complete
            this task. <strong>Telegram User ID is required</strong> for
            accurate verification due to Telegram Bot API limitations.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div>
            <Label htmlFor="telegram-userid">
              Telegram User ID (Required){' '}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="telegram-userid"
              type="text"
              placeholder="Your Telegram user ID (e.g., 123456789)"
              value={telegramUserId}
              onChange={(e) =>
                setTelegramUserId(e.target.value.replace(/\D/g, ''))
              }
              disabled={isLoading || isVerifying}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Numeric user ID is required for verification
            </p>
          </div>

          <div>
            <Label htmlFor="telegram-username">
              Telegram Username (Optional)
            </Label>
            <Input
              id="telegram-username"
              type="text"
              placeholder="username (without @)"
              value={telegramUsername}
              onChange={(e) =>
                setTelegramUsername(e.target.value.replace('@', ''))
              }
              disabled={isLoading || isVerifying}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional: Your username for additional verification
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleVerification}
          disabled={isLoading || isVerifying || !telegramUserId}
          className="w-full"
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying membership...
            </>
          ) : (
            'Verify Telegram Membership'
          )}
        </Button>

        {isVerifying && (
          <div className="text-xs text-muted-foreground text-center border rounded p-2 bg-blue-50">
            <p>Checking your membership via Telegram API...</p>
            <p>This may take a few moments due to network conditions.</p>
            <p className="text-orange-600">
              If it takes too long, we'll retry automatically.
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-2 border-t pt-3">
          <p>
            <strong>How to find your Telegram User ID:</strong>
          </p>
          <div className="bg-muted p-2 rounded text-xs space-y-1">
            <p>
              <strong>Method 1:</strong> Message @userinfobot on Telegram
            </p>
            <p>
              <strong>Method 2:</strong> Message @getmyid_bot on Telegram
            </p>
            <p>
              <strong>Method 3:</strong> Forward any message to @userinfobot
            </p>
          </div>
          <p className="text-orange-600">
            ⚠️ Username-only verification is not reliable due to Telegram API
            limitations. User ID is required for accurate membership
            verification.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
