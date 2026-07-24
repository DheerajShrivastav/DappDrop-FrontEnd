import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateNonce, NONCE_COOKIE, NONCE_TTL_SECONDS } from '@/lib/siwe'

// GET /api/auth/nonce — issue a fresh single-use SIWE nonce (FR-W3, NFR-20).
// The nonce is returned to the client (to embed in the EIP-4361 message) and also stored in
// an httpOnly cookie so the verify step can confirm it (double-submit) and consume it.
export async function GET() {
  const nonce = generateNonce()
  const cookieStore = await cookies()
  cookieStore.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: NONCE_TTL_SECONDS,
  })
  return NextResponse.json(
    { nonce },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
