import 'server-only'

import { getEntrypointReadContract } from './web3-service'

/**
 * Verify the SIWE-authenticated wallet is the on-chain host of `campaignId`. Used to gate
 * the allocation-pipeline endpoints (propose/latest/mark-published) — the pipeline proposes
 * on the platform's behalf, but only the campaign's own host may trigger/review it (BR-M3
 * keeps allocation authority with the host).
 */
export async function requireCampaignHost(
  campaignId: number,
  walletAddress: string,
): Promise<void> {
  const c = getEntrypointReadContract()
  const [host]: [string, number] = await c.getCampaignHostAndStatus(campaignId)
  if (host.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error('Only the campaign host can perform this action')
  }
}
