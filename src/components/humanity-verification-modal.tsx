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
import {
  ShieldCheck,
  Loader2,
  HelpCircle,
  CheckCircle2,
  Wallet,
  Edit3,
} from 'lucide-react'
import { useWallet } from '@/context/wallet-provider'
import { isValidEthereumAddress } from '@/lib/validation-utils'
import {
  HumanityConnect,
  type HumanityReactError,
} from '@humanity-org/react-sdk'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface HumanityVerificationModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  campaignId?: string
  taskId?: string
  isVerified?: boolean
  onVerificationComplete?: (isHuman: boolean) => void
}

export function HumanityVerificationModal({
  isOpen,
  onOpenChange,
  campaignId,
  taskId,
  isVerified = false,
  onVerificationComplete,
}: HumanityVerificationModalProps) {
  const { address, isConnected } = useWallet()
  const [useCustomAddress, setUseCustomAddress] = useState(false)
  const [customWalletAddress, setCustomWalletAddress] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  const selectedAddress = useCustomAddress ? customWalletAddress : address

  const canStartFlow = () => {
    if (useCustomAddress) {
      return customWalletAddress && isValidEthereumAddress(customWalletAddress)
    }
    return isConnected && address
  }

  // Store context in sessionStorage before the redirect so the callback page
  // and campaign page can pick it up after OAuth completes.
  const storeContextBeforeRedirect = () => {
    const walletToVerify = selectedAddress || address
    if (walletToVerify) {
      sessionStorage.setItem('humanity_wallet_address', walletToVerify)
    }
    sessionStorage.setItem('humanity_return_to', window.location.pathname)
    if (campaignId && taskId) {
      sessionStorage.setItem(
        'humanity_task_context',
        JSON.stringify({ campaignId, taskId }),
      )
    }
  }

  const handleAuthError = (error: HumanityReactError) => {
    console.error('Humanity auth error:', error)
    setIsRedirecting(false)
    if (error.code === 'popup_closed' || error.code === 'popup_blocked') {
      return
    }
    setVerificationError(error.message || 'Authentication failed. Please try again.')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] gap-4">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-purple-500" />
            Humanity Verification
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help ml-auto" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    <strong>Why verify?</strong> Prevents Sybil attacks and
                    ensures fair reward distribution through biometric
                    verification via Humanity Protocol.
                  </p>
                  <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
                    <li>One-time verification per wallet</li>
                    <li>Results cached for 24 hours</li>
                    <li>No personal data stored by DappDrop</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isVerified
              ? 'Your wallet is verified with Humanity Protocol.'
              : 'Verify your identity through Humanity Protocol to complete this task.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isVerified ? (
            <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-green-500/30 bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Verified</p>
                <p className="text-xs text-muted-foreground">
                  {address?.slice(0, 6)}...{address?.slice(-4)} is verified as
                  human
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Wallet selection */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Select wallet to verify</p>

                {/* Connected wallet option */}
                <button
                  onClick={() => setUseCustomAddress(false)}
                  disabled={!isConnected}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    !useCustomAddress && isConnected
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-border hover:border-border/80'
                  } ${
                    !isConnected
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      !useCustomAddress && isConnected
                        ? 'border-purple-500'
                        : 'border-muted-foreground'
                    }`}
                  >
                    {!useCustomAddress && isConnected && (
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                    )}
                  </div>
                  <Wallet className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-medium">Connected Wallet</span>
                  {isConnected && address && (
                    <span className="ml-auto text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  )}
                </button>

                {!isConnected && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5 pl-1">
                    No wallet connected. Use custom address below.
                  </p>
                )}

                {/* Custom address option */}
                <button
                  onClick={() => setUseCustomAddress(true)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    useCustomAddress
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      useCustomAddress
                        ? 'border-purple-500'
                        : 'border-muted-foreground'
                    }`}
                  >
                    {useCustomAddress && (
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                    )}
                  </div>
                  <Edit3 className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-medium">Custom Address</span>
                </button>

                {/* Custom address input */}
                {useCustomAddress && (
                  <div className="space-y-2 pl-7">
                    <Input
                      placeholder="0x..."
                      value={customWalletAddress}
                      onChange={(e) => setCustomWalletAddress(e.target.value)}
                      className="font-mono text-xs h-9"
                    />
                    {customWalletAddress &&
                      !isValidEthereumAddress(customWalletAddress) && (
                        <p className="text-xs text-destructive">
                          Invalid Ethereum address
                        </p>
                      )}
                  </div>
                )}
              </div>

              {/* Error message */}
              {verificationError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-xs text-destructive">{verificationError}</p>
                </div>
              )}

              {/* Redirecting state */}
              {isRedirecting && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                  <span className="text-sm text-muted-foreground">
                    Redirecting to Humanity Protocol...
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            {isVerified ? 'Close' : 'Cancel'}
          </Button>
          {!isVerified && !isRedirecting && (
            <div
              className="flex-1"
              onClick={() => {
                // Store context BEFORE the SDK triggers the redirect
                storeContextBeforeRedirect()
                setIsRedirecting(true)
              }}
            >
              <HumanityConnect
                scopes={['openid', 'identity:read']}
                mode="redirect"
                onError={handleAuthError}
                variant="primary"
                size="sm"
                label="Verify with Humanity"
                disabled={!canStartFlow()}
                className="w-full"
              />
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
