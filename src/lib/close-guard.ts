/**
 * The host-close guard, on its own so web3-service can use it without pulling date-fns `format`
 * (campaign-status.ts) into every route that touches the chain. Pure: no ethers, no React.
 */
import type { CampaignSettlement } from './types'

const ZERO_ROOT = '0x0000000000000000000000000000000000000000000000000000000000000000'
const hasRoot = (r: string | null | undefined) => Boolean(r && r !== ZERO_ROOT)

/**
 * Would `closeCampaign` revert `SettlementNotPublished` right now? Mirrors the contract's guard
 * (contracts PR #26, CampaignManagement.closeCampaign):
 *   (ERC20 settlement mode UNSET && ERC20 escrowed != 0) || (NFT module pinned && no NFT root)
 * The ERC20 mode is committed either by publishing a root (MERKLE) or by configuring tiers, which
 * pins the reward module in the same call; so "mode UNSET" reads here as no root and no pinned
 * reward module. Returns null when the facts it needs didn't load: callers must not read that as
 * "nothing owed".
 */
export function settlementOwedOnClose(s: CampaignSettlement | undefined): boolean | null {
  if (!s) return null

  let erc20: boolean | null
  if (s.mode === 'RANK_TIERED' || s.mode === 'SCORE_TIERED' || s.rewardModule || hasRoot(s.erc20MerkleRoot)) erc20 = false
  else if (s.erc20EscrowedNet === undefined) erc20 = null
  else {
    try {
      erc20 = BigInt(s.erc20EscrowedNet) > BigInt(0)
    } catch {
      erc20 = null
    }
  }

  let nft: boolean | null
  if (!s.nftModule && s.mode !== 'NFT') nft = false
  else if (hasRoot(s.nftMerkleRoot)) nft = false
  else if (s.nftMerkleRoot === undefined) nft = null
  else nft = true

  if (erc20 === true || nft === true) return true
  if (erc20 === null || nft === null) return null
  return false
}
