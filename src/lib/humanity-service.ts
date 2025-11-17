// src/lib/humanity-service.ts
import { clear } from 'console'
import { prisma } from './prisma'
import type {
  HumanityVerificationRequest,
  HumanityVerificationResponse,
} from './types'
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
    // Reset or create new attempt tracking
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
 * Verify a wallet address using Humanity Protocol API
 * @param walletAddress - The wallet address to verify
 * @param forceRefresh - If true, bypasses cache and forces fresh verification
 */
export async function verifyHumanity(
  walletAddress: string,
  forceRefresh: boolean = false
): Promise<HumanityVerificationResponse> {
  try {
    // Validate wallet address format
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      console.error('Invalid wallet address format:', walletAddress)
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'Invalid wallet address format',
      }
    }

    // Check rate limiting (but allow some leeway for force refresh)
    if (!forceRefresh && !checkRateLimit(walletAddress)) {
      console.warn('Rate limit exceeded for wallet:', walletAddress)
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'Rate limit exceeded. Please try again later.',
      }
    }

    // Check cache first, but with smart logic
    if (!forceRefresh) {
      const cachedVerification = await getCachedVerification(walletAddress)
      if (cachedVerification) {
        // Always trust positive verification results from cache
        if (cachedVerification.isHuman) {
          console.log(
            'Using cached positive Humanity verification for:',
            walletAddress
          )
          return {
            is_human: true,
            wallet_address: walletAddress,
            verified_at: cachedVerification.verifiedAt.toISOString(),
          }
        }

        // For negative results, only use cache if it's recent (within 1 hour)
        // This allows users to retry verification after completing the process
        const now = new Date()
        const cacheAge = now.getTime() - cachedVerification.verifiedAt.getTime()
        const oneHourMs = 60 * 60 * 1000

        if (cacheAge < oneHourMs) {
          console.log(
            'Using recent cached negative verification for:',
            walletAddress,
            'age:',
            Math.round(cacheAge / 1000 / 60),
            'minutes'
          )
          return {
            is_human: false,
            wallet_address: walletAddress,
            verified_at: cachedVerification.verifiedAt.toISOString(),
            error: 'Recently checked - not verified with Humanity Protocol',
          }
        } else {
          console.log(
            'Cached negative result is old (',
            Math.round(cacheAge / 1000 / 60),
            'minutes), allowing fresh check for:',
            walletAddress
          )
        }
      }
    } else {
      console.log(
        'Force refresh requested for:',
        walletAddress,
        'bypassing cache'
      )
    }

    // Call Humanity Protocol API
    const apiKey = process.env.HUMANITY_API_KEY
    if (!apiKey) {
      console.warn(
        'HUMANITY_API_KEY not configured - returning default response'
      )
      return {
        is_human: false,
        wallet_address: walletAddress,
        error: 'API key not configured',
      }
    }

    const apiUrl =
      process.env.HUMANITY_API_URL ||
      'https://testnet-api.humanity.org/v1/human/verify'

    console.log('Calling Humanity Protocol API for:', walletAddress)

    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    try {
      const response = await fetch(
        `${apiUrl}?wallet_address=${walletAddress}`,
        {
          method: 'GET',
          headers: {
            'X-HP-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      // Handle different response statuses gracefully
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.warn(
          `Humanity API responded with ${response.status}:`,
          errorText
        )

        // Handle specific error cases
        if (response.status === 404) {
          // Wallet not found in Humanity Protocol - this means not verified
          await updateUserVerificationStatus(walletAddress, false)
          return {
            is_human: false,
            wallet_address: walletAddress,
            error: 'Wallet not verified with Humanity Protocol',
          }
        }

        if (response.status === 401 || response.status === 403) {
          return {
            is_human: false,
            wallet_address: walletAddress,
            error: 'API authentication failed',
          }
        }

        // For other errors, return generic error
        return {
          is_human: false,
          wallet_address: walletAddress,
          error: `API error (${response.status}): ${errorText}`,
        }
      }

      const data: HumanityVerificationResponse = await response.json()
      console.log('Humanity Protocol verification result:', {
        wallet: walletAddress,
        isHuman: data.is_human,
        verifiedAt: data.verified_at,
      })

      // Update user record in database
      await updateUserVerificationStatus(walletAddress, data.is_human)

      return data
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        console.error('Humanity API request timed out for:', walletAddress)
        return {
          is_human: false,
          wallet_address: walletAddress,
          error: 'Humanity timed out',
        }
      }
      throw error
    }
  } catch (error: any) {
    console.error('Error during humanity verification:', {
      wallet: walletAddress,
      error: error.message,
      stack: error.stack,
    })

    // Return error response instead of throwing
    return {
      is_human: false,
      wallet_address: walletAddress,
      error: error.message || 'Network error during verification',
    }
  }
}

/**
 * Get cached verification result from database
 */
async function getCachedVerification(
  walletAddress: string
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
      console.log('No cached verification found for:', walletAddress)
      return null
    }

    // Check if cache is still valid
    const now = new Date()
    const cacheAge = now.getTime() - user.lastHumanityCheck.getTime()
    if (cacheAge > CACHE_TTL_MS) {
      console.log(
        'Cache expired for:',
        walletAddress,
        'age:',
        Math.round(cacheAge / 1000 / 60),
        'minutes'
      )
      return null
    }

    console.log(
      'Using valid cache for:',
      walletAddress,
      'verified:',
      user.humanityVerified
    )
    return {
      isHuman: user.humanityVerified || false,
      verifiedAt: user.lastHumanityCheck,
    }
  } catch (error) {
    console.warn(
      'Database error reading cached verification for:',
      walletAddress,
      error
    )
    // Don't fail the verification process due to cache errors
    return null
  }
}

/**
 * Update user verification status in database
 */
async function updateUserVerificationStatus(
  walletAddress: string,
  isHuman: boolean
): Promise<void> {
  try {
    const result = await prisma.user.upsert({
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
    console.log('Successfully updated verification status:', {
      wallet: walletAddress,
      isHuman: isHuman,
      userId: result.id,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.warn('Database error updating verification status:', {
      wallet: walletAddress,
      isHuman: isHuman,
      error: error,
    })
    // Don't throw - database failure shouldn't break verification flow
  }
}

/**
 * Check if a user is verified as human (using cache)
 */
export async function isUserVerified(walletAddress: string): Promise<boolean> {
  try {
    // Validate wallet address
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      console.warn(
        'Invalid wallet address for verification check:',
        walletAddress
      )
      return false
    }

    const cached = await getCachedVerification(walletAddress)
    if (cached) {
      console.log(
        'User verification status from cache:',
        walletAddress,
        cached.isHuman
      )
      return cached.isHuman
    }

    console.log('No cached verification found for:', walletAddress)
    return false
  } catch (error) {
    console.warn(
      'Error checking user verification status:',
      walletAddress,
      error
    )
    return false
  }
}

/**
 * Force refresh verification status for a user
 * This bypasses cache and forces a fresh verification check
 */
export async function refreshVerification(
  walletAddress: string
): Promise<{ success: boolean; isHuman: boolean; error?: string }> {
  try {
    console.log('Force refreshing verification for:', walletAddress)
    const result = await verifyHumanity(walletAddress, true) // Force refresh

    return {
      success: !result.error,
      isHuman: result.is_human,
      error: result.error,
    }
  } catch (error) {
    console.error('Error refreshing verification:', walletAddress, error)
    return {
      success: false,
      isHuman: false,
      error: 'Failed to refresh verification',
    }
  }
}
/**
 * Clear cached verification for a wallet address
 * Useful when user wants to force a fresh check
 */
export async function clearVerificationCache(
  walletAddress: string
): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { walletAddress: walletAddress.toLowerCase() },
      data: {
        lastHumanityCheck: null,
        humanityVerified: false,
      },
    })
    console.log('Cleared verification cache for:', walletAddress)
  } catch (error) {
    console.warn('Error clearing verification cache for:', walletAddress, error)
  }
}
