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
  onVerificationComplete: (success: boolean, message?: string) => void
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

    if (!telegramUsername && !telegramUserId) {
      setError('Please provide either your Telegram username or user ID')
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
          telegramUserId: telegramUserId || undefined,
        }),
      })

      const result = await response.json()

      if (result.success && result.verified) {
        onVerificationComplete(
          true,
          'Telegram membership verified successfully!'
        )
      } else {
        onVerificationComplete(false, result.error || 'Verification failed')
      }
    } catch (error) {
      console.error('Verification error:', error)
      onVerificationComplete(false, 'Failed to verify Telegram membership')
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
            this task. Provide either your username or user ID for verification.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div>
            <Label htmlFor="telegram-username">
              Telegram Username (Optional)
            </Label>
            <Input
              id="telegram-username"
              type="text"
              placeholder="@username (without @)"
              value={telegramUsername}
              onChange={(e) =>
                setTelegramUsername(e.target.value.replace('@', ''))
              }
              disabled={isLoading || isVerifying}
            />
          </div>

          <div className="text-center text-sm text-muted-foreground">OR</div>

          <div>
            <Label htmlFor="telegram-userid">Telegram User ID (Optional)</Label>
            <Input
              id="telegram-userid"
              type="text"
              placeholder="Your Telegram user ID"
              value={telegramUserId}
              onChange={(e) => setTelegramUserId(e.target.value)}
              disabled={isLoading || isVerifying}
            />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleVerification}
          disabled={
            isLoading || isVerifying || (!telegramUsername && !telegramUserId)
          }
          className="w-full"
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify Telegram Membership'
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>How to find your Telegram User ID:</strong>
          </p>
          <p>1. Message @userinfobot on Telegram</p>
          <p>2. Send any message to get your user ID</p>
          <p>3. Copy the ID number and paste it above</p>
        </div>
      </CardContent>
    </Card>
  )
}
