// src/app/humanity-callback/page.tsx
// OAuth redirect target for the Humanity SDK.
// After Humanity redirects here with an auth code, the HumanityProvider
// (loaded via layout) exchanges it for a token. This page watches for
// auth completion, reads the configured preset from sessionStorage,
// verifies it server-side, saves to DB, and redirects back to the campaign page.
'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth, useHumanity } from '@humanity-org/react-sdk'
// Direct module imports, not the '@/components/app' barrel: the barrel pulls every primitive
// (ScheduleField's calendar, ClaimActions…) into the route's first load.
import { Button, Spinner } from '@/components/app/button'
import { ErrorState } from '@/components/app/states'
import { PageContainer, PageHeader } from '@/components/app/page-header'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, accessToken, error: authError } = useAuth()
  const { verify } = useHumanity()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Completing sign-in…')
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
        setStatus('Checking your humanity status…')

        // Read the presets that were stored before the OAuth redirect.
        // May be a JSON array (new) or a plain string (old campaigns).
        const storedRaw = sessionStorage.getItem('humanity_preset') ?? 'is_human'
        let storedPresets: string[]
        try {
          const parsed = JSON.parse(storedRaw)
          storedPresets = Array.isArray(parsed) ? parsed : [parsed]
        } catch {
          // Old format: plain string like "is_human"
          storedPresets = [storedRaw]
        }

        // Client-side verify the first preset for UX feedback only
        await verify(storedPresets[0])

        setStatus('Saving the result…')

        // Send accessToken + all presets to backend for server-side verification.
        // The server validates the token against each preset.
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
              preset: storedPresets,
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

        setStatus('Taking you back to the campaign…')

        // Redirect back to the campaign page
        const returnPath = sessionStorage.getItem('humanity_return_to')
        sessionStorage.removeItem('humanity_return_to')
        sessionStorage.removeItem('humanity_preset')

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
      <PageContainer>
        <PageHeader eyebrow="Humanity check" title="Verifying" />
        <ErrorState
          className="mt-10"
          title="The humanity check didn’t go through."
          reason={error}
          action={
            <Button variant="secondary" onClick={() => router.replace(returnPath)}>
              Go back and try again
            </Button>
          }
        />
      </PageContainer>
    )
  }

  return <Pending status={status} />
}

/** The in-progress state: the step in words, announced politely. */
function Pending({ status }: { status: string }) {
  return (
    <PageContainer>
      <PageHeader eyebrow="Humanity check" title="Verifying" />
      <p role="status" className="mt-10 flex items-center gap-3 text-body text-ink-2">
        <Spinner />
        {status}
      </p>
    </PageContainer>
  )
}

// Mirrors HumanityAuthProvider (src/context/humanity-provider.tsx): without these the provider
// isn't mounted, and the SDK hooks above would throw (the page crashed to #__next_error__).
const HUMANITY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_HUMANITY_CLIENT_ID && process.env.NEXT_PUBLIC_HUMANITY_REDIRECT_URI)

export default function HumanityCallbackPage() {
  if (!HUMANITY_CONFIGURED) {
    return (
      <PageContainer>
        <PageHeader eyebrow="Humanity check" title="Verifying" />
        <ErrorState
          className="mt-10"
          title="The humanity check isn’t set up here."
          reason="This deployment has no Humanity sign-in configured, so there’s nothing to finish. Campaigns that need the check can’t verify it on this site yet."
          action={
            <Button asChild variant="secondary">
              <Link href="/campaigns">Back to campaigns</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }
  return (
    <Suspense
      fallback={<Pending status="Loading…" />}
    >
      <CallbackContent />
    </Suspense>
  )
}
