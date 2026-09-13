import 'server-only'

import { NextResponse } from 'next/server'
import { getEntrypointReadContract } from './web3-service'

/** A definitive "this wallet is not the host" answer, read successfully from chain. */
export class NotCampaignHostError extends Error {
  constructor() {
    super('Only the campaign host can perform this action')
    this.name = 'NotCampaignHostError'
  }
}

/** The host could NOT be determined — an RPC/provider failure, not an ownership answer. Callers
 * must surface this as retryable (503), never collapse it into "not the host": doing so silently
 * downgrades the real host to the restricted public view on a transient node hiccup, with no way
 * for them to tell the two apart. */
export class HostCheckUnavailableError extends Error {
  constructor(readonly cause: unknown) {
    super('Could not verify campaign ownership on-chain. Please try again.')
    this.name = 'HostCheckUnavailableError'
  }
}

/** The on-chain host of `campaignId` (BR-I4: the chain is authoritative — CampaignCache.hostAddress
 * is a display-only sync copy that can drift stale, never a substitute for this when the answer
 * routes money, a notification, or an authorization decision). */
export async function getCampaignHostOnChain(campaignId: number): Promise<string> {
  const c = getEntrypointReadContract()
  const [host]: [string, number] = await c.getCampaignHostAndStatus(campaignId)
  return host
}

/**
 * Verify the SIWE-authenticated wallet is the on-chain host of `campaignId`. Used to gate
 * the allocation-pipeline endpoints (propose/latest/mark-published) — the pipeline proposes
 * on the platform's behalf, but only the campaign's own host may trigger/review it (BR-M3
 * keeps allocation authority with the host).
 *
 * Throws NotCampaignHostError for a real mismatch, HostCheckUnavailableError if the chain read
 * itself failed — these are genuinely different answers and must not be conflated.
 */
export async function requireCampaignHost(
  campaignId: number,
  walletAddress: string,
): Promise<void> {
  let host: string
  try {
    host = await getCampaignHostOnChain(campaignId)
  } catch (e) {
    throw new HostCheckUnavailableError(e)
  }
  if (host.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new NotCampaignHostError()
  }
}

export type HostCheck =
  | { kind: 'host' }
  | { kind: 'not_host' }
  | { kind: 'unauthenticated' }
  | { kind: 'unavailable'; error: HostCheckUnavailableError }

/**
 * Resolve whether the SIWE session (if any) is this campaign's host, WITHOUT collapsing the
 * three distinct outcomes into a boolean. Shared by every route that shows a host one thing and
 * the public another (allocations/latest, nft-allocations/latest, the CSV export, reports), so
 * the visibility rule lives in one place instead of being copy-pasted per route.
 */
export async function checkCampaignHost(
  campaignId: number,
  verifySession: () => Promise<{ walletAddress: string }>,
): Promise<HostCheck> {
  let walletAddress: string
  try {
    ;({ walletAddress } = await verifySession())
  } catch {
    return { kind: 'unauthenticated' }
  }
  try {
    await requireCampaignHost(campaignId, walletAddress)
    return { kind: 'host' }
  } catch (e) {
    if (e instanceof HostCheckUnavailableError) return { kind: 'unavailable', error: e }
    return { kind: 'not_host' }
  }
}

/** 503 (retryable), never 403 — see HostCheckUnavailableError. */
export function hostCheckUnavailableResponse(check: Extract<HostCheck, { kind: 'unavailable' }>) {
  console.error('[require-host] on-chain host check failed:', check.error.cause)
  return NextResponse.json({ error: check.error.message }, { status: 503 })
}
