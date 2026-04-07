// src/lib/humanity-service.ts
// Server-side Humanity Protocol verification service (v2 - OAuth SDK based)
import { prisma } from './prisma'
import type { HumanityVerificationResponse } from './types'
import { isValidEthereumAddress } from './validation-utils'

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Rate limiting: Track verification attempts
const verificationAttempts = new Map<
  string,
  { count: number; resetAt: number }
>()
const MAX_ATTEMPTS_PER_HOUR = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

/**
 * Check rate limiting for a wallet address
 */
function checkRateLimit(walletAddress: string): boolean {
  const now = Date.now()
  const attempt = verificationAttempts.get(walletAddress)

  if (!attempt || now > attempt.resetAt) {
    verificationAttempts.set(walletAddress, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return true
  }

  if (attempt.count >= MAX_ATTEMPTS_PER_HOUR) {
    return false
  }

  attempt.count++
  return true
}

/**
 * Save humanity verification result from the OAuth SDK flow.
 * Called after the client completes the OAuth + verifyPresets flow.
 *
 * @param walletAddress - The wallet address being verified
 * @param isHuman - Whether the user passed the is_human preset
 * @param accessToken - The OAuth access token (for audit trail)
 */
export async function saveHumanityVerification(
  walletAddress: string,
  isHuman: boolean,
  accessToken?: string,
): Promise<HumanityVerificationResponse> {
  try {
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'Invalid wallet address format',
      }
    }

    if (!checkRateLimit(walletAddress)) {
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'Rate limit exceeded. Please try again later.',
      }
    }

    // Update user record in database
    await updateUserVerificationStatus(walletAddress, isHuman)

    return {
      is_human: isHuman,
      wallet_address: walletAddress,
      verified_at: new Date().toISOString(),
    }
  } catch (error: any) {
    console.error('Error saving humanity verification:', {
      wallet: walletAddress,
      error: error.message,
    })

    return {
      is_human: false,
      wallet_address: walletAddress,
      error: error.message || 'Failed to save verification result',
    }
  }
}

/**
 * Legacy verify function — kept for backwards compatibility with verify-task route.
 * In v2, this checks cached DB status instead of calling the Humanity API.
 * For fresh verification, the client must go through the OAuth flow.
 */
export async function verifyHumanity(
  walletAddress: string,
  forceRefresh: boolean = false,
): Promise<HumanityVerificationResponse> {
  try {
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'Invalid wallet address format',
      }
    }

    // In v2, we can only check cached status server-side.
    // Fresh verification requires the client OAuth flow.
    const cachedVerification = await getCachedVerification(walletAddress)

    if (cachedVerification) {
      if (cachedVerification.isHuman) {
        return {
          is_human: true,
          wallet_address: walletAddress,
          verified_at: cachedVerification.verifiedAt.toISOString(),
        }
      }

      // For negative results, only use cache if recent (within 1 hour)
      const cacheAge =
        Date.now() - cachedVerification.verifiedAt.getTime()
      if (cacheAge < 60 * 60 * 1000) {
        return {
          is_human: false,
          wallet_address: walletAddress,
          verified_at: cachedVerification.verifiedAt.toISOString(),
          error:
            'Not verified. Please complete Humanity Protocol OAuth verification.',
        }
      }
    }

    // No valid cache — user needs to go through OAuth flow
    return {
      is_human: false,
      wallet_address: walletAddress,
      error:
        'Verification required. Please complete Humanity Protocol verification.',
    }
  } catch (error: any) {
    console.error('Error during humanity verification check:', {
      wallet: walletAddress,
      error: error.message,
    })

    return {
      is_human: false,
      wallet_address: walletAddress,
      error: error.message || 'Error checking verification status',
    }
  }
}

/**
 * Get cached verification result from database
 */
async function getCachedVerification(
  walletAddress: string,
): Promise<{ isHuman: boolean; verifiedAt: Date } | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      select: {
        humanityVerified: true,
        lastHumanityCheck: true,
      },
    })

    if (!user || !user.lastHumanityCheck) {
      return null
    }

    const cacheAge = Date.now() - user.lastHumanityCheck.getTime()
    if (cacheAge > CACHE_TTL_MS) {
      return null
    }

    return {
      isHuman: user.humanityVerified || false,
      verifiedAt: user.lastHumanityCheck,
    }
  } catch (error) {
    console.warn(
      'Database error reading cached verification:',
      walletAddress,
      error,
    )
    return null
  }
}

/**
 * Update user verification status in database
 */
async function updateUserVerificationStatus(
  walletAddress: string,
  isHuman: boolean,
): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: {
        humanityVerified: isHuman,
        lastHumanityCheck: new Date(),
      },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        humanityVerified: isHuman,
        lastHumanityCheck: new Date(),
      },
    })
  } catch (error) {
    console.warn('Database error updating verification status:', {
      wallet: walletAddress,
      isHuman,
      error,
    })
  }
}

/**
 * Check if a user is verified as human (using cache)
 */
export async function isUserVerified(walletAddress: string): Promise<boolean> {
  try {
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return false
    }

    const cached = await getCachedVerification(walletAddress)
    return cached?.isHuman ?? false
  } catch (error) {
    console.warn('Error checking user verification:', walletAddress, error)
    return false
  }
}

/**
 * Clear cached verification for a wallet address
 */
export async function clearVerificationCache(
  walletAddress: string,
): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { walletAddress: walletAddress.toLowerCase() },
      data: {
        lastHumanityCheck: null,
        humanityVerified: false,
      },
    })
  } catch (error) {
    console.warn('Error clearing verification cache:', walletAddress, error)
  }
}
