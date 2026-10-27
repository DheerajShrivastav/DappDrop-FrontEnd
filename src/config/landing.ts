/**
 * Landing-page placeholders: every founder decision the landing page depends on, in ONE file.
 *
 * Each value below is the studio plan's "Default if undecided" (landing-studio/05-final/
 * landing-plan.md §7). Search this file for `TODO(founder)` to find what still needs a decision.
 * Nothing here is a secret, and nothing here may be a guess: a value that isn't confirmed stays
 * `null` / `false`, and the page renders the honest fallback.
 *
 * Contract addresses and the chain are NOT here: they come from the app config
 * (src/app/config.ts), which reads the deployment's env vars.
 */
import appConfig from '@/app/config'
import { chainName } from '@/lib/reward-plan'

// ---------------------------------------------------------------------------------------------
// Network: derived from the app config's chain, never hard-coded in copy.
// ---------------------------------------------------------------------------------------------

type NetworkInfo = {
  /** Block explorer origin for this chain (used for "Verified on Etherscan" links). */
  explorer: string
  /** Explorer's name, as shown in link text. */
  explorerName: string
  /** True on a test network: drives every "public beta on … testnet" line. */
  testnet: boolean
  /** What gas is paid in, in plain words. */
  gasToken: string
}

// TODO(founder): add the production L2 here when it's chosen (decision D10). Until then the page
// says "a single EVM Layer 2, to be announced".
const NETWORKS: Record<number, NetworkInfo> = {
  11155111: {
    explorer: 'https://sepolia.etherscan.io',
    explorerName: 'Sepolia Etherscan',
    testnet: true,
    gasToken: 'Sepolia ETH',
  },
}

const networkInfo: NetworkInfo = NETWORKS[appConfig.chainId] ?? {
  explorer: '',
  explorerName: 'the block explorer',
  testnet: true, // fail safe: never claim mainnet for an unknown chain
  gasToken: 'ETH',
}

export const network = {
  chainId: appConfig.chainId,
  /** "Sepolia" — from the app's own chain-name map. */
  name: chainName(appConfig.chainId),
  ...networkInfo,
  /** Entrypoint (Web3Campaigns) address: from the app config, which follows the deployment. */
  entrypoint: appConfig.addresses.entrypoint,
  /** Global default tier (OnChainRewardModule) and NFT settlement modules, from the app config. */
  rewardModule: appConfig.addresses.onChainRewardModule,
  nftModule: appConfig.addresses.nftSettlementModule,
  /** How many contracts make up the deployed suite (entrypoint + reward module + NFT module + lib). */
  deployedContracts: 4,
} as const

/** "Sepolia testnet" on a test network, the bare chain name otherwise. */
export const networkLabel = network.testnet ? `${network.name} testnet` : network.name

/** Verified-source tab for an address on this chain's explorer ('' if the chain is unknown). */
export function explorerCodeUrl(address: string): string {
  return network.explorer && address ? `${network.explorer}/address/${address}#code` : ''
}

// ---------------------------------------------------------------------------------------------
// Domain and repos
// ---------------------------------------------------------------------------------------------

export { officialDomain, siteOrigin, redirectHosts, repos } from './site'

// ---------------------------------------------------------------------------------------------
// Founder decisions (plan §7). Defaults = "Default if undecided".
// ---------------------------------------------------------------------------------------------

/**
 * TODO(founder): decision D5 / C2, the human channel ("Talk to the founder (20 min)").
 * Default: null → the page offers "Ask on GitHub" instead (never an anonymous "contact us").
 * Set to e.g. { channel: 'calendar', url: 'https://cal.com/…' } once the founder owns the link.
 */
export const founderContact: { channel: 'email' | 'calendar'; url: string } | null = null

/** TODO(founder): C2, is the founder named with a face on the page? Default: no. */
export const founderPublic = false

/**
 * TODO(founder): decision D9 / C3, official social handles. Default: NONE.
 * The old footer's t.me/dappdrop (another project's group) and discord.gg/dappdrop (dead invite)
 * must never come back; x.com/dappdrop's ownership is unconfirmed. Add only handles the founder
 * has confirmed owning. They render in the footer's "Official links" block and JSON-LD `sameAs`.
 */
export const officialLinks: ReadonlyArray<{ label: string; url: string }> = []

/** TODO(founder): decision D7 / C1, founding-host programme. Default: off (no form, no CTA). */
export const foundingHosts: { open: boolean; cap: number | null } = { open: false, cap: null }

/**
 * TODO(founder): decision C10 / OUT-O02, a fresh example campaign (equal split, NOT campaign 8)
 * taken through to claims. Default: none → the hero slip stays illustrative and shows no
 * "See a real one" link.
 */
export const exampleCampaign: { id: number; fundingTx: string } | null = null

/**
 * TODO(founder): decision D6 / C9, the test kit. Default: no faucet link (the page never links an
 * unvetted faucet). The studio's recommendation is Google Cloud's Sepolia faucet; the founder
 * must vet and approve it before it goes here.
 */
export const faucetUrl: string | null = null

/** TODO(founder): D6 / C9, a test reward token (or a "we'll send you tokens" offer). Default: none. */
export const testToken: { symbol: string; address: string } | null = null

/**
 * TODO(founder): decision D13 / C6, a LICENSE file in the contracts repo. The contracts repo has
 * none today (only SPDX headers), so the page says "Public code", never "open source".
 */
export const licenseFile = false

/**
 * TODO(founder): decision D18 / C12, may we name Humanity Protocol? Default: no → the page says
 * "a verified-human check".
 */
export const humanityNaming = false

/** TODO(founder): decision D11, privacy notice URL. Default: none → forms and waitlist are hidden. */
export const privacyNoticeUrl: string | null = null

/** TODO(founder): decision D11, the © entity. Default (TRS C45): the founder's name. */
export const copyrightHolder = 'Dheeraj Shrivastav'

/** TODO(founder): decision D18, a security@ contact. Default: GitHub issues only. */
export const securityContact: string | null = null

/**
 * Analytics (QW-07, decision D14): cookieless Plausible, OFF unless the env var is set at build
 * time. Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN to the site's Plausible domain to turn it on.
 */
export const analyticsDomain: string | null = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() || null

/**
 * TODO(founder): OUT-C06, the buyer summary at the top of the contracts repo's
 * docs/SECURITY_FINDINGS.md ("internal review notes, not an audit"; live vs pending; "no proxy").
 * Until it exists, proof chip 4 says "our security notes (internal review, not an audit)".
 */
export const securityBuyerSummary = false
