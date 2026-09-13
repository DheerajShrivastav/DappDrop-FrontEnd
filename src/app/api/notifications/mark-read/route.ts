// src/app/api/notifications/mark-read/route.ts
import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { markNotificationsRead } from '@/lib/notifications'

/**
 * POST /api/notifications/mark-read — mark specific notifications ({ ids: [...] }) or all
 * ({ all: true }) read for the authenticated wallet. Scoped so a wallet can only ever mark its
 * OWN notifications (markNotificationsRead filters on recipient === session wallet).
 */
export async function POST(request: Request) {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { ids?: string[]; all?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine — treated as no-op unless `all` is set
  }

  if (!body.all && (!Array.isArray(body.ids) || body.ids.length === 0)) {
    return NextResponse.json({ error: 'Provide { ids: [...] } or { all: true }' }, { status: 400 })
  }

  const marked = await markNotificationsRead(walletAddress, {
    ids: body.ids,
    all: body.all,
  })
  return NextResponse.json({ marked })
}
