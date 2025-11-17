// src/components/humanity-verification-modal.tsx
'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ShieldCheck, ExternalLink, Info, Wallet, Edit3 } from 'lucide-react'
import { useWallet } from '@/context/wallet-provider'
import { isValidEthereumAddress } from '@/lib/validation-utils'

interface HumanityVerificationModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onVerify?: (walletAddress?: string) => void
  isVerifying?: boolean
}

export function HumanityVerificationModal({
  isOpen,
  onOpenChange,
  onVerify,
  isVerifying = false,
}: HumanityVerificationModalProps) {
  const { address, isConnected } = useWallet()
  const [useCustomAddress, setUseCustomAddress] = useState(false)
  const [customWalletAddress, setCustomWalletAddress] = useState('')

  // Use environment variable or default to testnet
  const humanityPortalUrl =
    process.env.NEXT_PUBLIC_HUMANITY_PORTAL_URL ||
    'https://testnet.humanity.org'

  const handleOpenHumanityProtocol = () => {
    window.open(humanityPortalUrl, '_blank')
  }

  const handleVerify = () => {
    if (!onVerify) return

    const addressToVerify = useCustomAddress ? customWalletAddress : address
    if (!addressToVerify) return

    onVerify(addressToVerify)
  }

  const canVerify = () => {
    if (useCustomAddress) {
      return customWalletAddress && isValidEthereumAddress(customWalletAddress)
    }
    return isConnected && address
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
            This task requires you to be verified as a human through Humanity
            Protocol.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Why is this required?</AlertTitle>
            <AlertDescription>
              To prevent Sybil attacks and ensure fair distribution of rewards,
              this task requires biometric palm verification through Humanity
              Protocol. This ensures that each participant is a unique human
              being.
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

          {/* Wallet Address Selection */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Choose wallet address to verify:
              </Label>

              {/* Connected Wallet Option */}
              <div className="flex items-center space-x-3">
                <input
                  type="radio"
                  id="connected-wallet"
                  name="wallet-option"
                  checked={!useCustomAddress}
                  onChange={() => setUseCustomAddress(false)}
                  disabled={!isConnected}
                  className="w-4 h-4"
                />
                <label
                  htmlFor="connected-wallet"
                  className="flex items-center space-x-2 flex-1"
                >
                  <Wallet className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Use connected wallet</span>
                  {isConnected && address && (
                    <span className="text-xs text-muted-foreground font-mono bg-secondary px-2 py-1 rounded">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  )}
                </label>
              </div>

              {!isConnected && (
                <Alert className="py-2">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    No wallet connected. Please connect your wallet or use the
                    custom address option below.
                  </AlertDescription>
                </Alert>
              )}

              {/* Custom Address Option */}
              <div className="flex items-start space-x-3">
                <input
                  type="radio"
                  id="custom-wallet"
                  name="wallet-option"
                  checked={useCustomAddress}
                  onChange={() => setUseCustomAddress(true)}
                  className="w-4 h-4 mt-1"
                />
                <div className="flex-1 space-y-2">
                  <label
                    htmlFor="custom-wallet"
                    className="flex items-center space-x-2"
                  >
                    <Edit3 className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">Enter custom wallet address</span>
                  </label>
                  {useCustomAddress && (
                    <div className="space-y-2">
                      <Input
                        placeholder="0x..."
                        value={customWalletAddress}
                        onChange={(e) => setCustomWalletAddress(e.target.value)}
                        className="font-mono text-sm"
                      />
                      {customWalletAddress &&
                        !isValidEthereumAddress(customWalletAddress) && (
                          <p className="text-xs text-red-600">
                            Please enter a valid Ethereum address
                          </p>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Alert className="bg-purple-50 border-purple-200">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-900">
              Verification Details
            </AlertTitle>
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
              onClick={handleVerify}
              disabled={isVerifying || !canVerify()}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              {isVerifying
                ? 'Checking...'
                : `Verify ${useCustomAddress ? 'Custom' : 'Connected'} Wallet`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
