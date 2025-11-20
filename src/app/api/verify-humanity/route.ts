// src/app/api/verify-humanity/route.ts
import { NextResponse } from 'next/server'
import { verifyHumanity, isUserVerified } from '@/lib/humanity-service'
import { validateWalletAddress } from '@/lib/validation-utils'

/**
 * POST /api/verify-humanity
 * Verify a wallet address using Humanity Protocol
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { walletAddress, forceRefresh } = body

    // Validate and sanitize wallet address
    const validAddress = validateWalletAddress(walletAddress)

    console.log(
      'Verifying humanity for wallet:',
      validAddress,
      forceRefresh ? '(force refresh)' : '(using cache)'
    )
    const result = await verifyHumanity(validAddress, forceRefresh || false)

    // Check if verification was successful (no error in response)
    if (result.error) {
      console.log('Verification completed with error:', result.error)
      return NextResponse.json({
        success: true, // API call succeeded
        isHuman: result.is_human, // but verification failed
        walletAddress: result.wallet_address,
        error: result.error,
      })
    }

    return NextResponse.json({
      success: true,
      isHuman: result.is_human,
      walletAddress: result.wallet_address,
      verifiedAt: result.verified_at,
    })
  } catch (error: any) {
    console.error('Humanity verification API error:', error)

    // Handle validation errors
    if (
      error.message?.includes('required') ||
      error.message?.includes('Invalid')
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
     )
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to verify humanity',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/verify-humanity?walletAddress=0x...
 * Check cached verification status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    // Validate and sanitize wallet address
    const validAddress = validateWalletAddress(walletAddress || '')

    const isVerified = await isUserVerified(validAddress)

    return NextResponse.json({
      success: true,
      isHuman: isVerified,
      walletAddress: validAddress,
    })
  } catch (error: any) {
    console.error('Humanity verification check error:', error)

    // Handle validation errors
    if (
      error.message?.includes('required') ||
      error.message?.includes('Invalid')
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

     return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
  }
}
