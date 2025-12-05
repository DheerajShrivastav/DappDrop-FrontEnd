import 'server-only'

import { cookies } from 'next/headers'
import { cache } from 'react'
import { verifyAuthentication } from '@/lib/auth-utils'

/**
 * Verify wallet session from cookies
 * Uses React cache() to memoize within the same request
 * 
 * @returns { walletAddress: string } on success
 * @throws Error on verification failure
 */
export const verifyWalletSession = cache(async (): Promise<{ walletAddress: string }> => {
    const cookieStore = await cookies()

    const signature = cookieStore.get('wallet-signature')?.value
    const message = cookieStore.get('wallet-message')?.value

    if (!signature || !message) {
        throw new Error('Missing wallet authentication cookies')
    }

    const walletAddress = await verifyAuthentication(signature, message)

    if (!walletAddress) {
        throw new Error('Invalid wallet signature')
    }

    return { walletAddress }
})
