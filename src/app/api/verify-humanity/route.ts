// src/app/api/verify-humanity/route.ts
import { NextResponse } from 'next/server'
import { verifyHumanity, isUserVerified } from '@/lib/humanity-service'

/**
 * POST /api/verify-humanity
 * Verify a wallet address using Humanity Protocol
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { walletAddress } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }

    console.log('Verifying humanity for wallet:', walletAddress)
    const result = await verifyHumanity(walletAddress)

    return NextResponse.json({
      success: true,
      isHuman: result.is_human,
      walletAddress: result.wallet_address,
      verifiedAt: result.verified_at,
    })
  } catch (error: any) {
    console.error('Humanity verification API error:', error)
    
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

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      )
    }

    const isVerified = await isUserVerified(walletAddress)

    return NextResponse.json({
      success: true,
      isHuman: isVerified,
      walletAddress,
    })
  } catch (error: any) {
    console.error('Humanity verification check error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to check verification status',
        success: false,
      },
      { status: 500 }
    )
  }
}
