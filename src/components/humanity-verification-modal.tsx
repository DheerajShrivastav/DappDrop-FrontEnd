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
import {
  ShieldCheck,
  Loader2,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import { useWallet } from '@/context/wallet-provider'
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
import {
  getPresetConfig,
  getScopesForPresets,
  normalizePresets,
} from '@/lib/humanity-presets'

interface HumanityVerificationModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  campaignId?: string
  taskId?: string
  isVerified?: boolean
  onVerificationComplete?: (isHuman: boolean) => void
  /** Which Humanity preset(s) this task requires. Accepts single string or array. */
  preset?: string | string[]
}

export function HumanityVerificationModal({
  isOpen,
  onOpenChange,
  campaignId,
  taskId,
  isVerified = false,
  onVerificationComplete,
  preset,
}: HumanityVerificationModalProps) {
  const { address, isConnected } = useWallet()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  // Normalize to array and resolve configs + merged scopes
  const activePresets = normalizePresets(preset)
  const presetConfigs = activePresets
    .map((p) => getPresetConfig(p))
    .filter(Boolean) as NonNullable<ReturnType<typeof getPresetConfig>>[]
  const requiredScopes = getScopesForPresets(activePresets)

  // Store context in sessionStorage before the redirect so the callback page
  // and campaign page can pick it up after OAuth completes.
  const storeContextBeforeRedirect = () => {
    if (address) {
      sessionStorage.setItem('humanity_wallet_address', address)
    }
    // Store presets as JSON array so the callback can verify all of them
    sessionStorage.setItem('humanity_preset', JSON.stringify(activePresets))
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
              : `Verify your identity through Humanity Protocol to complete this task (${activePresets.length} check${activePresets.length > 1 ? 's' : ''} required).`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isVerified ? (
            <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-green-500/30 bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Verified Human</p>
                <p className="text-xs text-muted-foreground">
                  {address?.slice(0, 6)}...{address?.slice(-4)}&nbsp;is verified
                  with Humanity Protocol
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Preset info cards — show all required checks */}
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {presetConfigs.map((config) => (
                  <div
                    key={config.preset}
                    className="flex items-start gap-3 p-3 rounded-lg border border-purple-500/20 bg-purple-500/5"
                  >
                    <span className="text-lg mt-0.5 shrink-0" role="img" aria-label="preset icon">
                      {config.icon}
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {config.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {activePresets.length > 1 && (
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium text-center">
                  All {activePresets.length} checks must pass to complete this task
                </p>
              )}

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

              {!isConnected && !isRedirecting && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                  Please connect your wallet before verifying.
                </p>
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
                // Store presets + context BEFORE the SDK triggers the redirect
                storeContextBeforeRedirect()
                setIsRedirecting(true)
              }}
            >
              <HumanityConnect
                scopes={requiredScopes}
                mode="redirect"
                onError={handleAuthError}
                label="Connect Humanity Account"
                disabled={!isConnected}
                className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-purple-600 text-primary-foreground hover:bg-purple-700 [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0"
              />
            </div>
          )}

          {isVerified && onVerificationComplete && taskId && (
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => onVerificationComplete(true)}
            >
              Complete Task
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
