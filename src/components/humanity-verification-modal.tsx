// src/components/humanity-verification-modal.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  useHumanityOptional,
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
  const humanityCtx = useHumanityOptional()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(
    // If the Humanity provider is not available (env vars missing on deployment),
    // show an error immediately instead of letting HumanityConnect crash.
    humanityCtx === null
      ? 'Humanity Protocol is not configured. Please ensure NEXT_PUBLIC_HUMANITY_CLIENT_ID and NEXT_PUBLIC_HUMANITY_REDIRECT_URI are set in the environment.'
      : null,
  )

  // Check if the SDK already has a valid session (user already authenticated)
  // but respect the tokenExpired flag — if the token was rejected, fall back to redirect
  const isAlreadyAuthenticated = !tokenExpired && humanityCtx?.isAuthenticated === true && !!humanityCtx?.accessToken

  // Reset transient state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsRedirecting(false)
      setIsVerifying(false)
      setTokenExpired(false)
      if (humanityCtx !== null) setVerificationError(null)
    }
  }, [isOpen, humanityCtx])

  // Safety timeout: if redirecting takes more than 5s, something went wrong
  // (e.g. SDK is in "signed in" state and won't redirect)
  useEffect(() => {
    if (!isRedirecting) return
    const timer = setTimeout(() => {
      setIsRedirecting(false)
      setVerificationError(
        'Redirect did not complete. The Humanity SDK may already be signed in. Please use the "Verify Now" button below.',
      )
    }, 5000)
    return () => clearTimeout(timer)
  }, [isRedirecting])

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

  // When the SDK already has a session, we can verify server-side directly
  // without needing a redirect. This handles the "Signed in" button case.
  const handleDirectVerification = useCallback(async () => {
    if (!humanityCtx?.accessToken || !address) return

    setIsVerifying(true)
    setVerificationError(null)

    try {
      // Call our server-side verification endpoint directly
      const response = await fetch('/api/verify-humanity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          accessToken: humanityCtx.accessToken,
          preset: activePresets,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server-side verification failed')
      }

      if (!data.isHuman) {
        throw new Error('Humanity Protocol did not verify this wallet as human.')
      }

      // Notify parent component directly — don't rely on sessionStorage + useEffect
      // which won't re-fire because closing the modal doesn't change the effect's deps.
      if (onVerificationComplete) {
        onVerificationComplete(true)
      }
    } catch (err: any) {
      console.error('Direct verification error:', err)
      const errMsg = err.message || ''

      // If the token is expired/invalid, clear the SDK session and fall back to redirect
      if (errMsg.includes('token') || errMsg.includes('expired') || errMsg.includes('invalid') || errMsg.includes('Access token')) {
        setTokenExpired(true)
        // Try to log out from the SDK to clear stale session
        try {
          if (humanityCtx?.logout) await humanityCtx.logout()
        } catch { /* ignore logout errors */ }
        setVerificationError('Session expired. Please click "Connect Humanity Account" to re-authenticate.')
      } else {
        setVerificationError(errMsg || 'Verification failed. Please try again.')
      }
    } finally {
      setIsVerifying(false)
    }
  }, [humanityCtx?.accessToken, address, activePresets, onVerificationComplete])

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

              {!isConnected && !isRedirecting && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                  Please connect your wallet before verifying.
                </p>
              )}

              {/* Show info when SDK is already authenticated */}
              {isAlreadyAuthenticated && !isRedirecting && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                  <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Already signed in with Humanity Protocol. Click &quot;Verify Now&quot; to complete.
                  </p>
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

          {!isVerified && humanityCtx !== null && (
            <>
              {/* Primary path: if SDK already has a session, verify directly */}
              {isAlreadyAuthenticated ? (
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={!isConnected || isVerifying}
                  onClick={handleDirectVerification}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Verify Now
                    </>
                  )}
                </Button>
              ) : (
                /* Fallback: SDK not yet authenticated — use HumanityConnect redirect */
                <div
                  className="flex-1 relative"
                  onClick={() => {
                    if (isRedirecting) return
                    // Store presets + context BEFORE the SDK triggers the redirect
                    storeContextBeforeRedirect()
                    // Delay state update slightly so the SDK's internal click handler
                    // fires and initiates the redirect before React re-renders.
                    setTimeout(() => setIsRedirecting(true), 100)
                  }}
                >
                  {/* Always keep HumanityConnect mounted so the SDK can complete its redirect */}
                  <div className={isRedirecting ? 'opacity-0 pointer-events-none' : ''}>
                    <HumanityConnect
                      scopes={requiredScopes}
                      mode="redirect"
                      onError={handleAuthError}
                      label="Connect Humanity Account"
                      disabled={!isConnected}
                      className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-purple-600 text-primary-foreground hover:bg-purple-700 [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0"
                    />
                  </div>
                  {/* Overlay spinner when redirecting */}
                  {isRedirecting && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-md bg-purple-600/70 text-primary-foreground text-sm font-medium cursor-wait">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirecting...
                    </div>
                  )}
                </div>
              )}
            </>
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
