import { ethers } from 'ethers'

// Centralized configuration. Reads environment variables and exports a typed object.
//
// v0.6.0 NOTE (NFR-1 / NFR-2): the app targets the Web3Campaigns v0.6.0 suite, which is
// FOUR deployed contracts, not one. This config ships a chain-keyed ADDRESS BOOK
// (entrypoint + the two deployed satellite modules + deploy block) derived from the
// contract repo's docs/deployments/<chain>.md. Nothing here hardcodes a *chain* in
// logic — the active chain is read from NEXT_PUBLIC_CHAIN_ID, and a future L2 is added
// by dropping another entry into ADDRESS_BOOK plus setting the env overrides.
//
// IMPORTANT (NFR-2): the module addresses below are the GLOBAL DEFAULTS only. They are
// admin-rotatable on-chain, and each campaign PINS whichever module instance was current
// when it adopted a mode / took its first NFT deposit. Any per-campaign settlement call
// (claimNFT, claimReward, setNFTMerkleRoot, …) MUST resolve the module from chain state
// via getCampaignNFTModule(id) / getCampaignRewardModule(id) at read time — NEVER from
// this static book. The book is only for: (a) instantiating the entrypoint, (b) the
// indexer's data-source templates, (c) the funding/deposit call sites that legitimately
// use the current global default before a pin exists.
//
// OnChainRewardLib is a linked library baked into OnChainRewardModule's bytecode. It is
// NEVER called directly by the app and is intentionally EXCLUDED from this address book.

export type ChainAddressBook = {
  /** Web3Campaigns entrypoint — holds all funds + campaign state. */
  entrypoint: string
  /** OnChainRewardModule global default (RANK_TIERED / SCORE_TIERED settlement). */
  onChainRewardModule: string
  /** NFTSettlementModule global default (NFT Merkle settlement + escrow bookkeeping). */
  nftSettlementModule: string
  /** FeeModule — null when fees are disabled (the beta default; not deployed). */
  feeModule: string | null
  /** Block the suite was deployed at — the indexer's startBlock. */
  deployBlock: number
}

// Versioned address book, keyed by chainId. Source of truth:
// Dapp-Drop-Smart-Contract/docs/deployments/sepolia.md (v0.7.0, 2026-10-27; contracts dev @ 5aa3e13).
//
// The v0.7.0 redeploy (contracts PRs #23-#26) deployed EVERY contract fresh and together; never
// pair this Web3Campaigns with an older module. The NEXT_PUBLIC_* env overrides below win over these
// values, so an override left pointing at v0.6.0 would keep the app on the old contracts. With a
// new deployment also update subgraph/subgraph.yaml and src/config/claims.ts (deploy facts).
// src/config/hidden-campaigns.ts is keyed by entrypoint, so a new entrypoint hides nothing.
const ADDRESS_BOOK: Record<number, ChainAddressBook> = {
  // Sepolia (dev/beta)
  11155111: {
    // v0.7.0 Web3Campaigns (contracts PRs #23-#26).
    entrypoint: '0xC562505899faCee1F8f755F009cf6FbA3EA3E8Da',
    // v0.7.0 OnChainRewardModule (fixed, PR #23).
    onChainRewardModule: '0xDF0A0dd1459401EB75dBD2B64b9713B59626D19B',
    // v0.7.0 NFTSettlementModule.
    nftSettlementModule: '0xeb1229154D92234641000991345Ed725B112dB09',
    // No FeeModule: the v0.7.0 deploy ran with FEE_BPS unset (free; founder decision 2026-10-27).
    feeModule: null,
    // The block the v0.7.0 Web3Campaigns was deployed in (also the subgraph's startBlock).
    deployBlock: 12006087,
  },
  // Future L2 (PRD §6.1 open decision) — add its entry here + env overrides; no code change.
}

const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111', 10)

// Resolve the active chain's address book, allowing per-address env overrides so a fresh
// deployment can be pointed at without editing this file. Env override wins over the book.
const book: ChainAddressBook | undefined = ADDRESS_BOOK[chainId]

const entrypoint =
  process.env.NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT || book?.entrypoint || ''

const onChainRewardModule =
  process.env.NEXT_PUBLIC_ONCHAIN_REWARD_MODULE || book?.onChainRewardModule || ''

const nftSettlementModule =
  process.env.NEXT_PUBLIC_NFT_SETTLEMENT_MODULE || book?.nftSettlementModule || ''

const feeModule = process.env.NEXT_PUBLIC_FEE_MODULE || book?.feeModule || null

const deployBlock = book?.deployBlock ?? 0

// Validate every configured address at module load, with a clear per-field message.
for (const [label, value] of Object.entries({
  NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT: entrypoint,
  NEXT_PUBLIC_ONCHAIN_REWARD_MODULE: onChainRewardModule,
  NEXT_PUBLIC_NFT_SETTLEMENT_MODULE: nftSettlementModule,
  NEXT_PUBLIC_FEE_MODULE: feeModule,
})) {
  if (value && !ethers.isAddress(value)) {
    throw new Error(`Invalid Ethereum address for ${label}: ${value}`)
  }
}

const addresses: ChainAddressBook = {
  entrypoint,
  onChainRewardModule,
  nftSettlementModule,
  feeModule,
  deployBlock,
}

const config = {
  chainId,
  // Resolved v0.6.0 address book for the active chain.
  addresses,
  // Back-compat alias: existing read/write code uses `campaignFactoryAddress` for the
  // entrypoint. Kept as a synonym of addresses.entrypoint.
  campaignFactoryAddress: entrypoint,
  rpcUrl:
    process.env.NEXT_PUBLIC_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    'https://ethereum-sepolia.publicnode.com',
  humanityPortalUrl:
    process.env.NEXT_PUBLIC_HUMANITY_PORTAL_URL ||
    'https://testnet.humanity.org',
  apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT,
  discordBotInviteUrl: process.env.NEXT_PUBLIC_DISCORD_BOT_INVITE_URL,
  telegramBotUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
  uploadthingAppId: process.env.UPLOADTHING_APP_ID || '',
  // The Graph subgraph endpoint. When set, list queries use the subgraph instead of
  // direct RPC calls.
  // TODO(P0): the existing subgraph indexes the OLD (pre-v0.6.0) contract at a different
  // address and emits dead events (RewardSet/RewardClaimed). It MUST be rebuilt against
  // v0.6.0 (new entrypoint + satellite templates) before this URL is re-enabled — see
  // docs/DECISIONS_v0.6.0.md Decision 3. Until then, leave NEXT_PUBLIC_GRAPH_API_URL
  // unset so reads fall back to direct RPC against the correct v0.6.0 contract.
  graphApiUrl: process.env.NEXT_PUBLIC_GRAPH_API_URL || '',
}

// Warn if critical config is missing (development only).
if (process.env.NODE_ENV === 'development') {
  if (!config.campaignFactoryAddress) {
    console.warn(
      '⚠️  No entrypoint address resolved (NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT unset and no ADDRESS_BOOK entry for this chain). Web3 functionality will not work.',
    )
  }
}

export default config
