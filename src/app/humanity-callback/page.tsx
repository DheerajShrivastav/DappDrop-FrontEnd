// src/app/humanity-callback/page.tsx
// OAuth redirect target for the Humanity SDK.
// After Humanity redirects here with an auth code, the HumanityProvider
// (loaded via layout) exchanges it for a token. This page watches for
// auth completion, verifies the is_human preset, saves to DB, and
// redirects back to the campaign page.
'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth, useHumanity } from '@humanity-org/react-sdk'
import { Loader2 } from 'lucide-react'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, accessToken, error: authError } = useAuth()
  const { verify } = useHumanity()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Completing authentication...')
  const processedRef = useRef(false)

  // Check for OAuth error from the provider
  const oauthError = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  useEffect(() => {
    if (oauthError) {
      setError(`${oauthError}: ${errorDescription || 'Authentication failed'}`)
      return
    }

    if (authError) {
      console.error('Auth error from SDK:', authError)
      setError(authError.message || 'Authentication failed in SDK')
      return
    }

    // Wait for the SDK to finish processing the auth code
    if (isLoading) return
    
    if (!isAuthenticated || !accessToken) {
      // If loading finished but we aren't authenticated, something went silently wrong
      console.error('Finished loading but not authenticated. authStatus might be unauthenticated.')
      setError('Authentication failed: No access token or user identity was returned.')
      return
    }

    // Prevent double processing
    if (processedRef.current) return
    processedRef.current = true

    async function completeVerification() {
      try {
        setStatus('Verifying identity...')

        // Client-side verify for UX feedback only; server will re-validate
        await verify('is_human')

        setStatus('Saving verification...')

        // Send accessToken to backend for server-side verification.
        // The server validates the token against the Humanity Protocol
        // and determines isHuman — we do NOT send a client-side isHuman flag.
        const walletAddress = sessionStorage.getItem('humanity_wallet_address')
        let serverIsHuman = false
        let serverVerifiedAt: string | undefined

        if (walletAddress) {
          const response = await fetch('/api/verify-humanity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress,
              accessToken,
            }),
          })
          const data = await response.json()

          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Server-side verification failed')
          }

          serverIsHuman = data.isHuman
          serverVerifiedAt = data.verifiedAt
        }

        // Store the server-validated result for the campaign page to pick up
        sessionStorage.setItem(
          'humanity_verification_result',
          JSON.stringify({
            isHuman: serverIsHuman,
            verifiedAt: serverVerifiedAt ?? new Date().toISOString(),
          }),
        )

        setStatus('Redirecting...')

        // Redirect back to the campaign page
        const returnPath = sessionStorage.getItem('humanity_return_to')
        sessionStorage.removeItem('humanity_return_to')

        router.replace(returnPath || '/')
      } catch (err: any) {
        console.error('Verification error on callback:', err)
        setError(err.message || 'Verification failed. Please try again.')
        processedRef.current = false
      }
    }

    completeVerification()
  }, [isAuthenticated, isLoading, accessToken, oauthError, verify, router])

  if (error) {
    const returnPath = sessionStorage.getItem('humanity_return_to') || '/'
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h2 className="text-xl font-semibold text-destructive">
            Verification Error
          </h2>
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => router.replace(returnPath)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Go back and try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500" />
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  )
}

export default function HumanityCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
