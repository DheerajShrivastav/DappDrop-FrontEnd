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
        // A fresh successful verification un-revokes: a wallet that re-completes OAuth after a
        // prior revocation is verified again, so the stale revocation marker must be cleared or
        // it would misrepresent the wallet's current state (verified but "revoked").
        ...(isHuman ? { humanityRevokedAt: null } : {}),
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
 * TTL-BOUNDED courtesy read (verification is considered valid only if the last check is within
 * CACHE_TTL_MS). Correct for the verify-task path and the sponsored-claim RELAYER gate, where
 * erring toward "not verified" on a stale check is safe — it only withholds a convenience
 * (self-claim / re-verify remain available), never earned funds.
 *
 * Do NOT use this for Merkle tree-build enforcement — use isHumanityVerifiedDurable instead.
 * There, excluding a wallet is permanent (no leaf => mathematically cannot claim), so a stale
 * cache must never be treated as "unverified" or a real human loses rewards they earned.
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
 * DURABLE verification read for Merkle tree-build gating (PRIMARY humanity-gating enforcement,
 * docs/HUMANITY_GATING.md point 1). Unlike isUserVerified, this applies NO freshness TTL:
 * verification is a persistent property of a wallet ("one OAuth, once per wallet, ever"), and
 * the ONLY thing that removes it is an explicit revocation (revokeHumanityVerification, which
 * flips humanityVerified=false). Using the TTL-bounded read here would let a merely-aged cache
 * silently exclude a genuinely-verified human from the allocation tree — locking them out of
 * rewards with no recourse, since a missing leaf can never be claimed.
 *
 * Reads the same persisted column (User.humanityVerified) the OAuth callback writes and the
 * relayer gate reads, so all three stay consistent on a single source of truth.
 */
export async function isHumanityVerifiedDurable(walletAddress: string): Promise<boolean> {
  try {
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return false
    }
    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      select: { humanityVerified: true },
    })
    return user?.humanityVerified ?? false
  } catch (error) {
    console.warn('Error reading durable humanity status:', walletAddress, error)
    // Fail CLOSED: on a read error, treat as unverified. For tree-build gating that means the
    // wallet is excluded from THIS proposal (re-runnable once the DB is reachable) rather than
    // risking inclusion of an actually-unverified wallet in a humanity-gated allocation.
    return false
  }
}

/**
 * Revocation handling (docs/HUMANITY_GATING.md): when Humanity Protocol reports a
 * previously-verified wallet revoked, flip humanityVerified=false so FUTURE tree builds exclude
 * it (isHumanityVerifiedDurable returns false). Already-published roots are immutable — a
 * revocation after root publication does NOT claw back an allocation (accepted limitation, same
 * trust window as any off-chain allocation input; the 24h ROOT_DISPUTE_WINDOW is the backstop).
 *
 * NOTE: no automated Humanity revocation feed is wired in this phase — this is the correct
 * entry point, ready to be called from a Humanity webhook or periodic re-check when that trigger
 * is built (flagged as a follow-up, same as the doc frames it).
 */
export async function revokeHumanityVerification(walletAddress: string): Promise<void> {
  try {
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) return
    await prisma.user.updateMany({
      where: { walletAddress: walletAddress.toLowerCase() },
      data: {
        humanityVerified: false,
        humanityRevokedAt: new Date(),
      },
    })
  } catch (error) {
    console.warn('Error revoking humanity verification:', walletAddress, error)
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
