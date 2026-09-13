// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { listNotifications, unreadCount } from '@/lib/notifications'

/**
 * GET /api/notifications?limit=&unreadOnly= — the in-app notification center read path (BR-N*).
 * Scoped to the authenticated wallet's own notifications; no worker involved for in-app.
 */
export async function GET(request: Request) {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined
  const unreadOnly = searchParams.get('unreadOnly') === 'true'

  const [notifications, unread] = await Promise.all([
    listNotifications(walletAddress, { limit, unreadOnly }),
    unreadCount(walletAddress),
  ])

  return NextResponse.json({ notifications, unreadCount: unread })
}
