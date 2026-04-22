// src/app/api/verify-humanity/route.ts
import { NextResponse } from 'next/server'
import {
  saveHumanityVerification,
  isUserVerified,
} from '@/lib/humanity-service'
import { validateWalletAddress } from '@/lib/validation-utils'

/**
 * POST /api/verify-humanity
 * Save verification result from the Humanity Protocol OAuth SDK flow.
 * Called by the client after completing OAuth + verifyPresets.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { walletAddress, accessToken, preset = 'is_human' } = body

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Access token is required for verification' },
        { status: 400 },
      )
    }

    const validAddress = validateWalletAddress(walletAddress)

    // Normalize preset to an array (supports both single string and array)
    const presets: string[] = Array.isArray(preset) ? preset : [preset]

    // Verify each preset — all must pass for the user to be considered verified.
    // We verify the first preset with saveHumanityVerification (which also persists),
    // then verify any additional presets.
    let allPassed = true
    let lastVerifiedAt: string | undefined

    for (const p of presets) {
      const result = await saveHumanityVerification(validAddress, accessToken, p)

      if (result.error || !result.is_human) {
        return NextResponse.json(
          {
            success: false,
            isHuman: false,
            walletAddress: result.wallet_address,
            error: result.error || `Verification failed for preset: ${p}`,
            failedPreset: p,
          },
          { status: 403 },
        )
      }

      lastVerifiedAt = result.verified_at
    }

    return NextResponse.json({
      success: true,
      isHuman: true,
      walletAddress: validAddress,
      verifiedAt: lastVerifiedAt,
      presetsVerified: presets,
    })
  } catch (error: any) {
    console.error('Humanity verification API error:', error)

    if (
      error.message?.includes('required') ||
      error.message?.includes('Invalid')
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save verification' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/verify-humanity?walletAddress=0x...
 * Check cached verification status (unchanged from v1)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    const validAddress = validateWalletAddress(walletAddress || '')

    const isVerified = await isUserVerified(validAddress)

    return NextResponse.json({
      success: true,
      isHuman: isVerified,
      walletAddress: validAddress,
    })
  } catch (error: any) {
    console.error('Humanity verification check error:', error)

    if (
      error.message?.includes('required') ||
      error.message?.includes('Invalid')
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    )
  }
}
