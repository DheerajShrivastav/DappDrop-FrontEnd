import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { requireAdminRole } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { isValidEthereumAddress } from '@/lib/validation-utils'

/**
 * GET /api/admin/search?q=... — global campaign/host/participant search (P3 CP4). Gated on
 * MODERATOR (the least-privileged admin role that has a legitimate reason to look someone up)
 * — read-only, no destructive action reachable from here.
 *
 * The subgraph is disabled (docs/DECISIONS_v0.6.0.md Decision 3), so this searches the DB
 * (CampaignCache for title/host, User + SponsoredClaim + AllocationEntry for wallet activity)
 * rather than a proper indexed full-text search — a reasonable "smallest reasonable default"
 * for an internal ops tool, not a public-facing search experience.
 */
export async function GET(request: Request) {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifyWalletSession())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  try {
    await requireAdminRole(walletAddress, 'MODERATOR')
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  if (q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const isAddress = isValidEthereumAddress(q)
  const lowerQ = q.toLowerCase()

  const [campaignsByTitle, campaignsByHost, walletActivity] = await Promise.all([
    prisma.campaignCache.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      select: { campaignId: true, title: true, hostAddress: true, isActive: true, hiddenFromDiscovery: true },
      take: 25,
    }),
    isAddress
      ? prisma.campaignCache.findMany({
          where: { hostAddress: { equals: lowerQ, mode: 'insensitive' } },
          select: { campaignId: true, title: true, hostAddress: true, isActive: true, hiddenFromDiscovery: true },
          take: 25,
        })
      : Promise.resolve([]),
    isAddress
      ? Promise.all([
          prisma.user.findUnique({ where: { walletAddress: lowerQ } }),
          prisma.sponsoredClaim.count({ where: { account: lowerQ } }),
          prisma.allocationEntry.count({ where: { wallet: lowerQ } }),
        ])
      : Promise.resolve([null, 0, 0] as const),
  ])

  const [user, sponsoredClaimCount, allocationCount] = walletActivity

  return NextResponse.json({
    campaigns: [...campaignsByTitle, ...campaignsByHost.filter((c) => !campaignsByTitle.some((t) => t.campaignId === c.campaignId))],
    wallet: isAddress
      ? {
          address: lowerQ,
          humanityVerified: user?.humanityVerified ?? null,
          moderationFlagged: user?.moderationFlagged ?? null,
          sponsoredClaimCount,
          allocationCount,
        }
      : null,
  })
}
