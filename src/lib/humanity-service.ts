// src/lib/humanity-service.ts
// Server-side Humanity Protocol verification service (v2 - OAuth SDK based)
import { prisma } from './prisma'
import type { HumanityVerificationResponse } from './types'
import { isValidEthereumAddress } from './validation-utils'
import { HumanitySDK } from '@humanity-org/connect-sdk'

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

// Lazy-initialized singleton HumanitySDK instance for server-side verification
let _humanitySdk: HumanitySDK | null = null

function getHumanitySDK(): HumanitySDK {
  if (!_humanitySdk) {
    const clientId = process.env.NEXT_PUBLIC_HUMANITY_CLIENT_ID
    if (!clientId) {
      throw new Error('NEXT_PUBLIC_HUMANITY_CLIENT_ID is not configured')
    }
    _humanitySdk = new HumanitySDK({
      clientId,
      clientSecret: process.env.HUMANITY_CLIENT_SECRET,
      environment:
        (process.env.NEXT_PUBLIC_HUMANITY_ENVIRONMENT as 'sandbox' | 'production') ?? 'sandbox',
    })
  }
  return _humanitySdk
}

/**
 * Verify an access token against the Humanity Protocol server-side.
 * Uses the HumanitySDK.verifyPreset() to confirm the requested preset
 * directly with the protocol, ensuring the token is valid and the
 * user genuinely passes the check.
 *
 * @param accessToken - The OAuth access token to verify
 * @param preset - The Humanity preset to verify against (default: 'is_human')
 * @returns The verification result from the protocol
 * @throws Error if the token is invalid, expired, or verification fails
 */
export async function verifyHumanityToken(
  accessToken: string,
  preset: string = 'is_human',
): Promise<{ isHuman: boolean; verifiedAt?: string; presetChecked: string }> {
  const sdk = getHumanitySDK()

  const result = await sdk.verifyPreset({
    accessToken,
    preset,
  })

  return {
    isHuman: result.value === true && result.status === 'valid',
    verifiedAt: result.verifiedAt,
    presetChecked: preset,
  }
}

/**
 * Save humanity verification result after server-side validation.
 * The accessToken is verified against the Humanity Protocol before
 * persisting any result. The client-provided isHuman flag is ignored;
 * only the protocol's server-side response is trusted.
 *
 * @param walletAddress - The wallet address being verified
 * @param accessToken - The OAuth access token (required for server-side validation)
 * @param preset - The Humanity preset to verify against (default: 'is_human')
 */
export async function saveHumanityVerification(
  walletAddress: string,
  accessToken: string,
  preset: string = 'is_human',
): Promise<HumanityVerificationResponse> {
  try {
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'Invalid wallet address format',
      }
    }

    if (!accessToken) {
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'Access token is required for verification',
      }
    }

    if (!checkRateLimit(walletAddress)) {
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'Rate limit exceeded. Please try again later.',
      }
    }

    // Server-side verification: validate the token with Humanity Protocol
    let protocolResult: { isHuman: boolean; verifiedAt?: string; presetChecked: string }
    try {
      protocolResult = await verifyHumanityToken(accessToken, preset)
    } catch (tokenError: any) {
      console.error('Humanity Protocol token verification failed:', {
        wallet: walletAddress,
        error: tokenError.message,
      })
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'Access token verification failed. Token may be invalid or expired.',
      }
    }

    // Persist the protocol-verified result (NOT the client-provided value)
    await updateUserVerificationStatus(walletAddress, protocolResult.isHuman)

    return {
      is_human: protocolResult.isHuman,
      wallet_address: walletAddress,
      verified_at: protocolResult.verifiedAt ?? new Date().toISOString(),
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
