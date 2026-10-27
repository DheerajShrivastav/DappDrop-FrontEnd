/**
 * The deployment the production gates run against: the Sepolia entrypoint from the app's own
 * address book (src/app/config.ts), and its live campaign count, read over public RPC (a view
 * call; nothing is sent). Lets the gates assert what the live pages SHOULD show for this
 * deployment (the empty / not-found states while it has no campaigns, a real campaign page once
 * it has one) instead of hard-coding campaign ids from an older deployment.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Contract, JsonRpcProvider } from 'ethers'

/** The address the app is built against: the env override if the build had one, else the book. */
export function gatedEntrypoint(): string {
  const override = process.env.NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT
  if (override) return override
  const src = readFileSync(path.join(process.cwd(), 'src/app/config.ts'), 'utf8')
  const m = /11155111:\s*\{[\s\S]*?entrypoint:\s*'(0x[0-9a-fA-F]{40})'/.exec(src)
  if (!m) throw new Error('No Sepolia entrypoint in src/app/config.ts ADDRESS_BOOK')
  return m[1]
}

let cached: Promise<number> | null = null

/** getCampaignCount() on the gated entrypoint (cached per test worker). */
export function deployedCampaignCount(): Promise<number> {
  cached ??= (async () => {
    const rpc = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com'
    const c = new Contract(gatedEntrypoint(), ['function getCampaignCount() view returns (uint256)'], new JsonRpcProvider(rpc, 11155111, { staticNetwork: true }))
    return Number(await c.getCampaignCount())
  })()
  return cached
}
