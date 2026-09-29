/**
 * Reward-step rules and formatting for the create wizard. Pure (no ethers, no React) so the zod
 * schema, the step UI and the Review step share one implementation.
 *
 * The tier rules mirror OnChainRewardLib.validateAndStore{Rank,Score}Tiers. They matter more than
 * they look: tiers are configured AFTER createCampaign and funding, so a tier set the contract
 * rejects leaves the host with a funded Draft stuck mid-setup.
 */

export const MAX_TIERS = 10 // OnChainRewardLib: len == 0 || len > 10 reverts TooManyTiers

// --- Amounts -------------------------------------------------------------------------------

/** Plain decimal: digits with an optional fractional part ("12", "12.5", ".5", "5."). No
 * exponents, signs or separators (a comma is a thousands separator in one locale and a decimal
 * point in another). */
const DECIMAL_RE = /^(\d+\.?\d*|\.\d+)$/

export function isDecimalString(s: string | undefined | null): boolean {
  return typeof s === 'string' && DECIMAL_RE.test(s.trim())
}

export function isPositiveDecimalString(s: string | undefined | null): boolean {
  return isDecimalString(s) && /[1-9]/.test((s as string).trim())
}

export type ParsedAmount =
  | { ok: true; value: bigint }
  | { ok: false; reason: 'format' | 'zero' | 'precision'; message: string }

/** Parse a human amount into base units for a token with `decimals` decimals. */
export function parseTokenAmount(input: string, decimals: number): ParsedAmount {
  const s = (input ?? '').trim()
  if (!DECIMAL_RE.test(s)) {
    return { ok: false, reason: 'format', message: 'Use digits and an optional decimal point, e.g. 1000 or 12.5.' }
  }
  const [wholeRaw, frac = ''] = s.split('.')
  const whole = wholeRaw || '0'
  if (frac.length > decimals) {
    return {
      ok: false,
      reason: 'precision',
      message:
        decimals === 0
          ? 'This token has no decimal places — use a whole number.'
          : `This token supports at most ${decimals} decimal place${decimals === 1 ? '' : 's'}.`,
    }
  }
  const value = BigInt(whole + frac.padEnd(decimals, '0'))
  if (value === BigInt(0)) return { ok: false, reason: 'zero', message: 'The amount must be greater than 0.' }
  return { ok: true, value }
}

/** Base units -> "12,345.6789" (grouped; trailing zeros trimmed; at most `maxFraction` places,
 * except that a non-zero value is never shown as "0" — tiny amounts get full precision). */
export function formatTokenAmount(value: bigint, decimals: number, maxFraction = 4): string {
  const short = formatFixed(value, decimals, maxFraction)
  return value !== BigInt(0) && /^-?0$/.test(short) ? formatFixed(value, decimals, decimals) : short
}

function formatFixed(value: bigint, decimals: number, maxFraction: number): string {
  const neg = value < BigInt(0)
  const v = neg ? -value : value
  const base = BigInt(10) ** BigInt(decimals)
  const whole = (v / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  let frac = decimals > 0 ? (v % base).toString().padStart(decimals, '0').slice(0, maxFraction) : ''
  frac = frac.replace(/0+$/, '')
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`
}

// --- Rank tiers ----------------------------------------------------------------------------

export type RankTierInput = { startRank: number | string; endRank: number | string; amount: string }

const toInt = (v: number | string) => (typeof v === 'number' ? v : /^\d+$/.test(String(v).trim()) ? Number(v) : NaN)

/** Contract order: ascending by startRank. The form keeps the host's row order; this is what
 * gets submitted and previewed. */
export function sortRankTiers<T extends RankTierInput>(tiers: T[]): T[] {
  return [...tiers].sort((a, b) => toInt(a.startRank) - toInt(b.startRank))
}

/** First problem the contract would reject, or null. Checked on the SORTED tiers, so row order
 * never matters — only real overlaps and bad ranges do. */
export function rankTierProblem(tiers: RankTierInput[]): string | null {
  if (tiers.length === 0) return 'Add at least one rank tier.'
  if (tiers.length > MAX_TIERS) return `Use at most ${MAX_TIERS} tiers.`
  for (const t of tiers) {
    const s = toInt(t.startRank)
    const e = toInt(t.endRank)
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < 1 || e < 1) return 'Ranks must be whole numbers starting at 1.'
    if (s > e) return `A tier can't start after it ends (rank ${s}–${e}).`
    if (!isPositiveDecimalString(t.amount)) return 'Give every tier an amount greater than 0.'
  }
  const sorted = sortRankTiers(tiers)
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = toInt(sorted[i - 1].endRank)
    const start = toInt(sorted[i].startRank)
    if (start <= prevEnd) {
      return `Tiers overlap: rank ${start} is already covered by ${toInt(sorted[i - 1].startRank)}–${prevEnd}.`
    }
  }
  return null
}

/** A new tier continues right after the highest rank already covered. */
export function nextRankTier(tiers: RankTierInput[]): { startRank: number; endRank: number; amount: string } {
  const ends = tiers.map((t) => toInt(t.endRank)).filter((n) => Number.isInteger(n))
  const start = ends.length ? Math.max(...ends) + 1 : 1
  return { startRank: start, endRank: start, amount: '' }
}

/** Most the tiers can ever pay out: Σ (end − start + 1) × amount. Null if any amount can't be
 * parsed at this precision. */
export function rankTiersMaxPayout(tiers: RankTierInput[], decimals: number): bigint | null {
  let total = BigInt(0)
  for (const t of tiers) {
    const s = toInt(t.startRank)
    const e = toInt(t.endRank)
    const a = parseTokenAmount(t.amount, decimals)
    if (!a.ok || !Number.isInteger(s) || !Number.isInteger(e) || e < s) return null
    total += BigInt(e - s + 1) * a.value
  }
  return total
}

// --- Score tiers ---------------------------------------------------------------------------

export type ScoreTierInput = { minScore: number | string; amount: string }

/** Contract order: minScore strictly DESCENDING (validateAndStoreScoreTiers reverts on
 * minScores[i] >= minScores[i-1]). Sorting here means the host can enter them in any order. */
export function sortScoreTiers<T extends ScoreTierInput>(tiers: T[]): T[] {
  return [...tiers].sort((a, b) => toInt(b.minScore) - toInt(a.minScore))
}

export function scoreTierProblem(tiers: ScoreTierInput[]): string | null {
  if (tiers.length === 0) return 'Add at least one score tier.'
  if (tiers.length > MAX_TIERS) return `Use at most ${MAX_TIERS} tiers.`
  const seen = new Set<number>()
  for (const t of tiers) {
    const m = toInt(t.minScore)
    if (!Number.isInteger(m) || m < 0) return 'Minimum scores must be whole numbers (0 or more).'
    if (seen.has(m)) return `Two tiers use the same minimum score (${m}). Each needs a different one.`
    seen.add(m)
    if (!isPositiveDecimalString(t.amount)) return 'Give every tier an amount greater than 0.'
  }
  return null
}

/** Largest single-wallet payout across score tiers, in base units. */
export function scoreTiersMaxPerWallet(tiers: ScoreTierInput[], decimals: number): bigint | null {
  let max = BigInt(0)
  for (const t of tiers) {
    const a = parseTokenAmount(t.amount, decimals)
    if (!a.ok) return null
    if (a.value > max) max = a.value
  }
  return max
}

// --- NFTs ----------------------------------------------------------------------------------

export type NftRow = { id: string; qty: string }

/** Comma/newline/whitespace-separated list -> trimmed non-empty entries. */
export function splitList(raw: string): string[] {
  return (raw ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** The form stores NFT rewards as two parallel strings (tokenIds / tokenAmounts) — the shape
 * submit already consumes. The table edits rows and serialises back to that. */
export function nftRowsFromStrings(ids: string, amounts: string | undefined): NftRow[] {
  const idList = (ids ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
  const qtyList = (amounts ?? '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
  return idList.map((id, i) => ({ id, qty: qtyList[i] ?? '1' }))
}

export function nftRowsToStrings(rows: NftRow[]): { tokenIds: string; tokenAmounts: string } {
  const kept = rows.filter((r) => r.id.trim() !== '')
  return {
    tokenIds: kept.map((r) => r.id.trim()).join('\n'),
    // A blank quantity serialises as 0 (which validation rejects), never as a silent 1 — and never
    // as an empty entry, which would shift every later quantity onto the wrong token ID.
    tokenAmounts: kept.map((r) => r.qty.trim() || '0').join('\n'),
  }
}

/** Parse a pasted block: one item per line/entry; "id qty", "id:qty" or "id,qty" per line
 * for ERC1155, bare ids otherwise. */
export function parsePastedNftList(raw: string, withQty: boolean): NftRow[] {
  const lines = (raw ?? '').split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (!withQty) return splitList(lines.join(' ')).map((id) => ({ id, qty: '1' }))
  return lines.map((l) => {
    const [id, qty] = l.split(/[\s:,]+/)
    return { id: id ?? '', qty: qty ?? '1' }
  })
}

export function nftRowsProblem(rows: NftRow[], standard: 'ERC721' | 'ERC1155'): string | null {
  const kept = rows.filter((r) => r.id.trim() !== '')
  if (kept.length === 0) return 'Add at least one token ID.'
  const seen = new Set<string>()
  const dups = new Set<string>()
  for (const r of kept) {
    const id = r.id.trim()
    if (!/^\d+$/.test(id)) return `"${id}" isn't a valid token ID — use whole numbers.`
    const key = BigInt(id).toString() // "007" and "7" are the same token
    if (seen.has(key)) dups.add(key)
    seen.add(key)
    if (standard === 'ERC1155' && !/^[1-9]\d*$/.test(r.qty.trim())) {
      return `Token ${id}: quantity must be a whole number of at least 1.`
    }
  }
  // ERC721 only: a unique token can't be deposited twice, so a repeat would revert mid-deposit.
  // For ERC1155 a repeated ID is legitimately two separate prizes — each deposit row is handed to
  // its own winner (nft-allocation.ts, one item per wallet in deposit order).
  if (standard === 'ERC721' && dups.size) {
    return `Duplicate token ID${dups.size > 1 ? 's' : ''}: ${[...dups].slice(0, 5).join(', ')}. An ERC721 token can only be deposited once.`
  }
  return null
}

// --- Network label -------------------------------------------------------------------------

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  11155111: 'Sepolia',
  8453: 'Base',
  84532: 'Base Sepolia',
  137: 'Polygon',
}

export function chainName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `chain ${chainId}`
}
