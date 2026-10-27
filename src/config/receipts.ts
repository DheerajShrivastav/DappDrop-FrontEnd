/**
 * S1-08: the "Check ↗" receipts (B's borrowed idea 1; CD-revisions §2.3, RED-07/24, F28, D-X11).
 *
 * Two kinds:
 * - "contract": "Enforced by the contract", with a link to the code that enforces the rule;
 * - "app": "Done by our app", a label only (no code link until a production app tag exists).
 *
 * Rules (binding):
 * - No receipt on a code path with a known unfixed issue: each fix-dependent receipt names the
 *   flag it needs (`requires`) and only renders when that flag is true.
 * - Links point to the DEPLOYED code: the contracts repo at `deployedTag` when it's set, else the
 *   contract's verified source on the block explorer. Never to `dev` (D-X11).
 * - Each link's accessible name says which rule, which network and which version (F28).
 *
 * Pure module (no React), so tests/landing and the unit tests can import it.
 */
import type { Claims } from './claims'

export type ReceiptId =
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R5'
  | 'R6'
  | 'R7'
  | 'walletBinding'
  | 'noProxy'
  | 'escrowRead'
  | 'tasks'
  | 'rank'
  | 'points'
  | 'nft'
  | 'equalSplit'
  | 'leftOff'
  | 'humanityFilter'

type FixFlag = 'tasksEnforcedOnChain' | 'tierModuleFixed' | 'tieredCancelLive' | 'hostCloseGuarded' | 'nftCustodyFixed'

export type ReceiptDef = {
  kind: 'contract' | 'app'
  /** Plain-English title used in the accessible name ("Rule R4, 24-hour window"). */
  title: string
  /** Source file in the contracts repo (contract receipts). */
  file?: string
  /** Which deployed contract's verified source to fall back to. */
  contract?: 'entrypoint' | 'rewardModule' | 'nftModule'
  /** The fix flag this receipt depends on; absent = true on the deployed v0.6.0 code too. */
  requires?: FixFlag
}

export const RECEIPTS: Record<ReceiptId, ReceiptDef> = {
  R1: { kind: 'contract', title: 'Rule R1, participant cap', file: 'src/CampaignManagement.sol', contract: 'entrypoint' },
  R2: { kind: 'contract', title: 'Rule R2, cancel and refund when nobody joined', file: 'src/CampaignManagement.sol', contract: 'entrypoint' },
  R3: { kind: 'contract', title: 'Rule R3, nobody can end it early', file: 'src/CampaignManagement.sol', contract: 'entrypoint' },
  R4: { kind: 'contract', title: 'Rule R4, 24-hour window before claims', file: 'src/CampaignStorage.sol', contract: 'entrypoint' },
  R5: { kind: 'contract', title: 'Rule R5, 14-day fallback publisher', file: 'src/CampaignManagement.sol', contract: 'entrypoint', requires: 'hostCloseGuarded' },
  R6: { kind: 'contract', title: 'Rule R6, 30 days to claim after close', file: 'src/CampaignStorage.sol', contract: 'entrypoint', requires: 'hostCloseGuarded' },
  R7: { kind: 'contract', title: 'Rule R7, payout module pinned per campaign', file: 'src/CampaignManagement.sol', contract: 'entrypoint' },
  walletBinding: { kind: 'contract', title: 'Rewards bound to the earning wallet', file: 'src/ParticipantManagement.sol', contract: 'entrypoint' },
  noProxy: { kind: 'contract', title: 'No proxy, core contract not upgradeable', file: 'src/Web3Campaigns.sol', contract: 'entrypoint' },
  escrowRead: { kind: 'contract', title: 'Escrowed amount readable by campaign ID', file: 'src/CampaignViewFunctions.sol', contract: 'entrypoint' },
  tasks: { kind: 'contract', title: 'Only the verifier or a contract check completes a task', file: 'src/ParticipantManagement.sol', contract: 'entrypoint', requires: 'tasksEnforcedOnChain' },
  rank: { kind: 'contract', title: 'Rank payouts computed by the contract', file: 'src/OnChainRewardLib.sol', contract: 'rewardModule', requires: 'tasksEnforcedOnChain' },
  points: { kind: 'contract', title: 'Points payouts computed by the contract', file: 'src/OnChainRewardLib.sol', contract: 'rewardModule', requires: 'tierModuleFixed' },
  nft: { kind: 'contract', title: 'NFT payouts, one item per qualifying wallet', file: 'src/NFTSettlementModule.sol', contract: 'nftModule', requires: 'nftCustodyFixed' },
  equalSplit: { kind: 'app', title: 'Equal split proposed by our app' },
  leftOff: { kind: 'app', title: 'Wallets left off by our app' },
  humanityFilter: { kind: 'app', title: 'Humanity filter applied by our app' },
}

/** The receipts allowed on the deployed v0.6.0 code (CD-revisions §2.3): no fix flag needed. */
export const BASELINE_RECEIPTS: ReceiptId[] = (Object.keys(RECEIPTS) as ReceiptId[]).filter((id) => !RECEIPTS[id].requires)

type FlagSource = Pick<Claims, FixFlag>

export function receiptVisible(id: ReceiptId, c: FlagSource): boolean {
  const req = RECEIPTS[id].requires
  return !req || c[req] === true
}

export function visibleReceipts(c: FlagSource): ReceiptId[] {
  return (Object.keys(RECEIPTS) as ReceiptId[]).filter((id) => receiptVisible(id, c))
}

export type ReceiptTarget = {
  href: string
  /** "deployed v0.7.0 on Sepolia" or "verified source on Sepolia Etherscan". */
  where: string
}

/**
 * Where a contract receipt points: the file at the deployed tag, else the contract's verified
 * source on the explorer. Returns null for "app" receipts or when neither is available.
 */
export function receiptTarget(
  id: ReceiptId,
  deploy: { deployedTag: string | null; deployVersion: string | null },
  env: {
    reposContracts: string
    networkName: string
    explorerName: string
    codeUrl: (address: string) => string
    addresses: { entrypoint: string; rewardModule: string; nftModule: string }
  },
): ReceiptTarget | null {
  const r = RECEIPTS[id]
  if (r.kind !== 'contract') return null
  if (deploy.deployedTag && r.file) {
    const v = deploy.deployVersion ? `v${deploy.deployVersion.replace(/^v/, '')}` : deploy.deployedTag
    return { href: `${env.reposContracts}/blob/${deploy.deployedTag}/${r.file}`, where: `deployed ${v} on ${env.networkName}` }
  }
  const addr = env.addresses[r.contract ?? 'entrypoint']
  const href = addr ? env.codeUrl(addr) : ''
  return href ? { href, where: `verified source on ${env.explorerName}` } : null
}
