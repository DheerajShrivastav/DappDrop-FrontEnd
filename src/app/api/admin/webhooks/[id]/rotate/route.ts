import { NextRequest, NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { generateWebhookSecret } from '@/lib/webhook-signing'

/**
 * POST /api/admin/webhooks/:id/rotate — issues a new HMAC secret for an existing endpoint,
 * returned ONCE in the response body and never again (P3 CP4). In-flight WebhookDelivery rows
 * are unaffected — their `signature` was computed once at enqueue over the OLD secret and is
 * never recomputed (see WebhookDelivery model doc), so rotating mid-retry does not break them.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    await requireAdminRole(walletAddress, 'DEFAULT_ADMIN')
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.webhookEndpoint.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Webhook endpoint not found' }, { status: 404 })
  }

  const secret = generateWebhookSecret()
  const endpoint = await prisma.webhookEndpoint.update({
    where: { id },
    data: { secret },
    select: { id: true, hostAddress: true, url: true, active: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json({ endpoint, secret })
}
