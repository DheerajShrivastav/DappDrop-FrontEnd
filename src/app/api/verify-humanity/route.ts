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
    const { walletAddress } = body

    // Validate and sanitize wallet address
    const validAddress = validateWalletAddress(walletAddress)

    console.log('Verifying humanity for wallet:', validAddress)
    const result = await verifyHumanity(validAddress)

    return NextResponse.json({
      success: true,
      isHuman: result.is_human,
      walletAddress: result.wallet_address,
      verifiedAt: result.verified_at,
    })
  } catch (error: any) {
    console.error('Humanity verification API error:', error)
    
    // Handle validation errors
    if (error.message?.includes('required') || error.message?.includes('Invalid')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    // Handle rate limiting
    if (error.message?.includes('Rate limit')) {
      return NextResponse.json(
        { error: error.message },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to verify humanity',
        success: false,
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
    if (error.message?.includes('required') || error.message?.includes('Invalid')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      {
        error: error.message || 'Failed to check verification status',
        success: false,
      },
      { status: 500 }
    )
  }
}
