import { NextRequest, NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/webhooks/:id/deactivate — flips `active` to false (P3 CP4). The dispatcher
 * worker only enqueues/sends to endpoints where `active` is true; already-enqueued
 * WebhookDelivery rows for this endpoint keep retrying under the existing retry policy — this
 * does not cancel in-flight deliveries, only stops new events from being routed here.
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

  const endpoint = await prisma.webhookEndpoint.update({
    where: { id },
    data: { active: false },
    select: { id: true, hostAddress: true, url: true, active: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json({ endpoint })
}
