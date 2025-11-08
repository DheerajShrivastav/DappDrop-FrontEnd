// src/lib/humanity-service.ts
import { prisma } from './prisma'
import type {
  HumanityVerificationRequest,
  HumanityVerificationResponse,
} from './types'

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Rate limiting: Track verification attempts
const verificationAttempts = new Map<string, { count: number; resetAt: number }>()
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
 */
export async function verifyHumanity(
  walletAddress: string
): Promise<HumanityVerificationResponse> {
  try {
    // Check rate limiting
    if (!checkRateLimit(walletAddress)) {
      throw new Error(
        'Rate limit exceeded. Please try again later.'
      )
    }

    // Check cache first
    const cachedVerification = await getCachedVerification(walletAddress)
    if (cachedVerification) {
      console.log('Using cached Humanity verification for:', walletAddress)
      return {
        is_human: cachedVerification.isHuman,
        wallet_address: walletAddress,
        verified_at: cachedVerification.verifiedAt.toISOString(),
      }
    }

    // Call Humanity Protocol API
    const apiKey = process.env.HUMANITY_API_KEY
    if (!apiKey) {
      console.error('HUMANITY_API_KEY not configured')
      // For development/testing: return a permissive response
      // In production, this should throw an error
      return {
        is_human: true,
        wallet_address: walletAddress,
        error: 'API key not configured - using default verification',
      }
    }

    const apiUrl =
      process.env.HUMANITY_API_URL ||
      'https://testnet-api.humanity.org/v1/human/verify'

    console.log('Calling Humanity Protocol API for:', walletAddress)
    const response = await fetch(
      `${apiUrl}?wallet_address=${walletAddress}`,
      {
        method: 'GET',
        headers: {
          'X-HP-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Humanity API error:', response.status, errorText)
      throw new Error(
        `Humanity Protocol API error: ${response.status} ${errorText}`
      )
    }

    const data: HumanityVerificationResponse = await response.json()
    console.log('Humanity Protocol response:', data)

    // Update user record in database
    await updateUserVerificationStatus(walletAddress, data.is_human)

    return data
  } catch (error: any) {
    console.error('Error verifying humanity:', error)
    throw new Error(error.message || 'Failed to verify humanity')
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
      return null
    }

    // Check if cache is still valid
    const now = new Date()
    const cacheAge = now.getTime() - user.lastHumanityCheck.getTime()
    if (cacheAge > CACHE_TTL_MS) {
      console.log('Cache expired for:', walletAddress)
      return null
    }

    return {
      isHuman: user.humanityVerified || false,
      verifiedAt: user.lastHumanityCheck,
    }
  } catch (error) {
    console.error('Error reading cached verification:', error)
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
    console.log('Updated verification for:', walletAddress, 'isHuman:', isHuman)
  } catch (error) {
    console.error('Error updating user verification status:', error)
    // Don't throw - database failure shouldn't break verification
  }
}

/**
 * Check if a user is verified as human (using cache)
 */
export async function isUserVerified(walletAddress: string): Promise<boolean> {
  const cached = await getCachedVerification(walletAddress)
  if (cached) {
    return cached.isHuman
  }
  return false
}

/**
 * Force refresh verification status for a user
 */
export async function refreshVerification(
  walletAddress: string
): Promise<boolean> {
  const result = await verifyHumanity(walletAddress)
  return result.is_human
}
