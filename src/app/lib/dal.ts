import 'server-only'

import { cookies } from 'next/headers'
import { cache } from 'react'
import { verifyAuthentication } from '@/lib/auth-utils'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/siwe'

/**
 * Resolve the authenticated wallet for the current request. Memoized per request.
 *
 * Prefers the real SIWE session (FR-W3/W4); falls back to the legacy per-request
 * signature cookies for flows not yet migrated.
 * TODO(P1): remove the legacy fallback once image-upload/uploadthing-cleanup move to SIWE.
 *
 * @returns { walletAddress } on success
 * @throws Error when neither a SIWE session nor legacy signature cookies are valid
 */
export const verifyWalletSession = cache(
  async (): Promise<{ walletAddress: string }> => {
    const cookieStore = await cookies()

    // 1. Real SIWE session.
    const siweAddress = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
    if (siweAddress) {
      return { walletAddress: siweAddress }
    }

    // 2. Legacy per-request signature cookies (deprecated).
    const signature = cookieStore.get('wallet-signature')?.value
    const message = cookieStore.get('wallet-message')?.value
    if (signature && message) {
      const walletAddress = await verifyAuthentication(signature, message)
      if (walletAddress) return { walletAddress }
    }

    throw new Error('Not authenticated')
  },
)
