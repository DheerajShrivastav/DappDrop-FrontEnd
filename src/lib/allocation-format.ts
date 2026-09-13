import { formatUnits } from 'ethers'

/**
 * Display-only formatting for allocation amounts. Single source of truth — this was previously
 * copy-pasted verbatim across the settlement panels, the claim panel, the public allocation
 * table and the lifecycle banner, so a decimals/locale fix had to be found and re-applied in
 * every one of them.
 *
 * Amounts everywhere else (claims, proofs, reconciliation, the leaf encoding) stay in on-chain
 * BASE UNITS as strings — nothing here ever feeds back into a value-bearing path. When the
 * token's decimals can't be resolved, the raw base-unit string is returned LABELLED as such
 * rather than guessing a scale that could misrepresent the real allocation.
 */
export function formatAllocationAmount(
  raw: string,
  decimals: number | null | undefined,
  symbol: string | null | undefined,
): string {
  if (decimals == null) return `${raw} (raw units — token decimals unavailable)`
  try {
    const formatted = formatUnits(raw, decimals)
    return symbol ? `${formatted} ${symbol}` : formatted
  } catch {
    return `${raw} (raw units)`
  }
}

/** NFT allocations are discrete items, not a divisible amount — an ERC1155 quantity is only
 * worth showing when it's more than one. */
export function formatNFTAllocation(
  standard: string | null | undefined,
  tokenId: string | null | undefined,
  amount: string | null | undefined,
): string {
  if (!standard || tokenId == null) return 'NFT allocation'
  const base = `${standard} #${tokenId}`
  return standard === 'ERC1155' && amount && amount !== '1' ? `${base} × ${amount}` : base
}
