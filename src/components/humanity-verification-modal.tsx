// src/components/humanity-verification-modal.tsx
'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ShieldCheck, ExternalLink, Info } from 'lucide-react'

interface HumanityVerificationModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onVerify?: () => void
  isVerifying?: boolean
}

export function HumanityVerificationModal({
  isOpen,
  onOpenChange,
  onVerify,
  isVerifying = false,
}: HumanityVerificationModalProps) {
  const handleOpenHumanityProtocol = () => {
    window.open('https://testnet.humanity.org', '_blank')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            Humanity Protocol Verification Required
          </DialogTitle>
          <DialogDescription>
            This task requires you to be verified as a human through Humanity Protocol.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Why is this required?</AlertTitle>
            <AlertDescription>
              To prevent Sybil attacks and ensure fair distribution of rewards, this task
              requires biometric palm verification through Humanity Protocol. This ensures
              that each participant is a unique human being.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">How to get verified:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Visit the Humanity Protocol verification portal</li>
              <li>Connect your wallet (the same wallet you're using here)</li>
              <li>Complete the palm scan verification process</li>
              <li>Return here and try again</li>
            </ol>
          </div>

          <Alert className="bg-purple-50 border-purple-200">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-900">Verification Details</AlertTitle>
            <AlertDescription className="text-purple-800">
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>One-time verification per wallet</li>
                <li>Results cached for 24 hours</li>
                <li>Privacy-focused biometric verification</li>
                <li>No personal data stored</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleOpenHumanityProtocol}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Go to Humanity Protocol
          </Button>
          {onVerify && (
            <Button
              onClick={onVerify}
              disabled={isVerifying}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              {isVerifying ? 'Checking...' : 'Check Verification Status'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
