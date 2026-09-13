import { NextRequest, NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { isValidEthereumAddress } from '@/lib/validation-utils'
import { generateWebhookSecret } from '@/lib/webhook-signing'

/**
 * Webhook endpoint admin console (P3 CP4, closes P2.5's flagged gap: WebhookEndpoint rows had
 * no create/rotate/deactivate path at all — worker/webhook-dispatcher.ts only ever READ them).
 *
 * Scope decision: this is an ADMIN-gated screen managing ALL hosts' endpoints, not a host
 * self-service screen — hosts don't yet have their own settings UI for this, and standing this
 * up as an admin tool first (secret shown once, DEFAULT_ADMIN-gated) is the smallest reasonable
 * default. A future host-facing screen would reuse the same lib functions, scoped to
 * `hostAddress === session host`.
 *
 * The secret is generated here, returned ONCE in the create/rotate response body, and never
 * again — GET always omits it.
 */

const WEBHOOK_ENDPOINT_SELECT = {
  id: true,
  hostAddress: true,
  url: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET() {
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

  const endpoints = await prisma.webhookEndpoint.findMany({
    select: WEBHOOK_ENDPOINT_SELECT,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ endpoints }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}))
  const hostAddress = typeof body?.hostAddress === 'string' ? body.hostAddress.toLowerCase() : ''
  const url = typeof body?.url === 'string' ? body.url : ''

  if (!isValidEthereumAddress(hostAddress)) {
    return NextResponse.json({ error: 'Valid hostAddress is required' }, { status: 400 })
  }
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Valid url is required' }, { status: 400 })
  }
  if (parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Webhook url must be https' }, { status: 400 })
  }

  const secret = generateWebhookSecret()
  const endpoint = await prisma.webhookEndpoint.create({
    data: { hostAddress, url, secret, active: true },
    select: WEBHOOK_ENDPOINT_SELECT,
  })

  return NextResponse.json({ endpoint, secret })
}
