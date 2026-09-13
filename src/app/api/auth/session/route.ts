import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/siwe'

// GET /api/auth/session — return the current SIWE session ({ address }) or null.
export async function GET() {
  const cookieStore = await cookies()
  const address = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
  return NextResponse.json(
    { address },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
