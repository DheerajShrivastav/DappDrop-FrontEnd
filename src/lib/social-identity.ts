import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Discord / Telegram accounts linked to a wallet, server-side.
 *
 * Linking only ever happens after the platform itself proved the account (Discord OAuth code
 * exchange; Telegram Login Widget hash), for the SIWE session wallet. Task verification reads the
 * linked ID from here and ignores any ID or username the client sends — before this, anyone could
 * type another member's Discord/Telegram ID and pass.
 *
 * One account ↔ one wallet: an account already linked to a different wallet is refused (the
 * @unique columns make that hold even under concurrent requests). Relinking the SAME wallet to a
 * different account replaces the old link.
 */

export type SocialPlatform = 'discord' | 'telegram'

export type LinkResult = { ok: true } | { ok: false; reason: 'taken' }

const FIELDS = {
  discord: { id: 'discordId', username: 'discordUsername', at: 'discordLinkedAt' },
  telegram: { id: 'telegramId', username: 'telegramUsername', at: 'telegramLinkedAt' },
} as const

export async function linkSocialAccount(
  wallet: string,
  platform: SocialPlatform,
  account: { id: string; username: string | null },
): Promise<LinkResult> {
  const w = wallet.toLowerCase()
  const f = FIELDS[platform]
  const holder = await prisma.user.findFirst({
    where: { [f.id]: account.id } as Prisma.UserWhereInput,
    select: { walletAddress: true },
  })
  if (holder && holder.walletAddress.toLowerCase() !== w) return { ok: false, reason: 'taken' }

  const data = { [f.id]: account.id, [f.username]: account.username, [f.at]: new Date() }
  try {
    await prisma.user.upsert({
      where: { walletAddress: w },
      update: data,
      create: { walletAddress: w, ...data },
    })
    return { ok: true }
  } catch (e) {
    // Lost a race with another wallet linking the same account: the unique index decided.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, reason: 'taken' }
    throw e
  }
}

/** The participant's self-entered X handle (unverified — proof-by-post is what checks it). */
export async function getXHandle(wallet: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { walletAddress: wallet.toLowerCase() }, select: { xHandle: true } })
  return u?.xHandle ?? null
}

export async function setXHandle(wallet: string, handle: string | null): Promise<void> {
  const w = wallet.toLowerCase()
  const data = { xHandle: handle, xHandleUpdatedAt: new Date() }
  await prisma.user.upsert({ where: { walletAddress: w }, update: data, create: { walletAddress: w, ...data } })
}

/** Has this X handle already completed this post task for a DIFFERENT wallet? */
export async function xHandleUsedByAnotherWallet(params: {
  handle: string
  campaignId: number
  taskIndex: number
  wallet: string
}): Promise<boolean> {
  const row = await prisma.socialVerification.findFirst({
    where: {
      taskId: `${params.campaignId}-${params.taskIndex}`,
      platform: 'TWITTER',
      isValid: true,
      userAddress: { not: params.wallet.toLowerCase(), mode: 'insensitive' },
      proofData: { path: ['xHandle'], equals: params.handle.toLowerCase() },
    },
    select: { id: true },
  })
  return row !== null
}

export async function unlinkSocialAccount(wallet: string, platform: SocialPlatform): Promise<void> {
  const f = FIELDS[platform]
  await prisma.user.updateMany({
    where: { walletAddress: wallet.toLowerCase() },
    data: { [f.id]: null, [f.username]: null, [f.at]: null },
  })
}

export type LinkedAccounts = {
  discord: { id: string; username: string | null } | null
  telegram: { id: string; username: string | null } | null
}

export async function getLinkedAccounts(wallet: string): Promise<LinkedAccounts> {
  const u = await prisma.user.findUnique({
    where: { walletAddress: wallet.toLowerCase() },
    select: { discordId: true, discordUsername: true, telegramId: true, telegramUsername: true },
  })
  return {
    discord: u?.discordId ? { id: u.discordId, username: u.discordUsername } : null,
    telegram: u?.telegramId ? { id: u.telegramId, username: u.telegramUsername } : null,
  }
}

/**
 * Has this platform account already completed this task for a DIFFERENT wallet? Linking is one-
 * to-one at any moment, but without this an account could link → verify → unlink → link to a
 * second wallet → verify the same task again.
 */
export async function accountUsedByAnotherWallet(params: {
  platform: SocialPlatform
  accountId: string
  campaignId: number
  taskIndex: number
  wallet: string
}): Promise<boolean> {
  const row = await prisma.socialVerification.findFirst({
    where: {
      taskId: `${params.campaignId}-${params.taskIndex}`,
      platform: params.platform === 'discord' ? 'DISCORD' : 'TELEGRAM',
      isValid: true,
      // Older rows may hold checksummed addresses.
      userAddress: { not: params.wallet.toLowerCase(), mode: 'insensitive' },
      proofData: {
        path: [params.platform === 'discord' ? 'discordId' : 'userId'],
        equals: params.accountId,
      },
    },
    select: { id: true },
  })
  return row !== null
}
