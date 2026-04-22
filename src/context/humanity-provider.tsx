// src/context/humanity-provider.tsx
'use client'

import { HumanityProvider as BaseHumanityProvider } from '@humanity-org/react-sdk'

export function HumanityAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const clientId = process.env.NEXT_PUBLIC_HUMANITY_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_HUMANITY_REDIRECT_URI
  const environment = process.env.NEXT_PUBLIC_HUMANITY_ENVIRONMENT ?? 'sandbox'

  // If credentials are not configured, render children without the provider
  if (!clientId || !redirectUri) {
    return <>{children}</>
  }

  return (
    <BaseHumanityProvider
      clientId={clientId}
      redirectUri={redirectUri}
      environment={environment}
      storage="sessionStorage"
    >
      {children}
    </BaseHumanityProvider>
  )
}
