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
import { ShieldCheck, ExternalLink, Info, Wallet, Edit3, ChevronDown, HelpCircle } from 'lucide-react'
import { useWallet } from '@/context/wallet-provider'
import { isValidEthereumAddress } from '@/lib/validation-utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
  const [showInstructions, setShowInstructions] = useState(false)

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
      <DialogContent className="sm:max-w-[480px] gap-4">
        {/* Compact Header with Tooltip */}
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-purple-500" />
            Humanity Verification Required
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help ml-auto" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    <strong>Why verify?</strong> Prevents Sybil attacks and ensures fair reward distribution through biometric palm verification.
                  </p>
                  <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
                    <li>One-time verification per wallet</li>
                    <li>Results cached for 24 hours</li>
                    <li>No personal data stored</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Verify your wallet through Humanity Protocol to continue.
          </DialogDescription>
        </DialogHeader>

        {/* Collapsible Instructions */}
        <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-4 w-4 transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
            How it works
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <ol className="text-xs text-muted-foreground space-y-1.5 pl-5 list-decimal">
              <li>Visit Humanity Protocol portal</li>
              <li>Connect your wallet</li>
              <li>Complete palm scan verification</li>
              <li>Return and verify here</li>
            </ol>
          </CollapsibleContent>
        </Collapsible>

        {/* Compact Wallet Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Select wallet</Label>
          
          {/* Connected Wallet - Compact Card */}
          <button
            onClick={() => setUseCustomAddress(false)}
            disabled={!isConnected}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
              !useCustomAddress && isConnected
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-border hover:border-border/80'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              !useCustomAddress && isConnected ? 'border-purple-500' : 'border-muted-foreground'
            }`}>
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
            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
              <Info className="h-3 w-3" />
              No wallet connected. Use custom address below.
            </p>
          )}

          {/* Custom Address - Compact Card */}
          <button
            onClick={() => setUseCustomAddress(true)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
              useCustomAddress
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-border hover:border-border/80'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              useCustomAddress ? 'border-purple-500' : 'border-muted-foreground'
            }`}>
              {useCustomAddress && (
                <div className="w-2 h-2 rounded-full bg-purple-500" />
              )}
            </div>
            <Edit3 className="h-4 w-4 text-foreground" />
            <span className="text-sm font-medium">Custom Address</span>
          </button>

          {/* Custom Address Input */}
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

        {/* Streamlined Footer */}
        <DialogFooter className="gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenHumanityProtocol}
            className="flex-1"
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Get Verified
          </Button>
          {onVerify && (
            <Button
              size="sm"
              onClick={handleVerify}
              disabled={isVerifying || !canVerify()}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isVerifying ? 'Checking...' : 'Verify'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
