/**
 * Internal test runs hidden from /campaigns by default (a "Show hidden (n)" toggle reveals
 * them, and every campaign stays reachable at /campaign/<id>). Discovery-only: this never
 * affects a campaign's state, tasks or claims.
 *
 * Keyed by entrypoint address, because campaign ids restart at 1 on every redeploy: a bare id
 * list would silently hide the NEW deployment's first campaigns. A deployment with no entry
 * hides nothing.
 *
 * Add an id only when it's confirmed to be an internal test run, with a comment saying what it
 * is and who confirmed it.
 */
import config from '@/app/config'

export const HIDDEN_CAMPAIGNS_BY_ENTRYPOINT: Record<string, readonly string[]> = {
  // Sepolia v0.6.0 entrypoint (src/app/config.ts ADDRESS_BOOK). Ids from the 2026-10-16 app
  // audit (landing-studio/08-site/app-audit.md §1; app-design.md §2.1 "4 internal test runs").
  // Pending founder confirmation.
  '0xf0a2fac02ffba4a7762f2f0d611253b6c97bb1b3': [
    '1', // "P2 Relayer Test (throwaway)"
    '2', // "CP1 Rank-Tiered Live Test"
    '3', // "CP1 Score-Tiered Live Test"
    '4', // "CP2 NFT Live Test"
  ],
}

/** Hidden ids for an entrypoint (case-insensitive); empty when none are listed. */
export function hiddenCampaignIdsFor(entrypoint: string): ReadonlySet<string> {
  return new Set(HIDDEN_CAMPAIGNS_BY_ENTRYPOINT[entrypoint.toLowerCase()] ?? [])
}

/** Hidden ids for the configured deployment. */
export const HIDDEN_CAMPAIGN_IDS: ReadonlySet<string> = hiddenCampaignIdsFor(
  config.addresses.entrypoint || '',
)

/** Split a list into what /campaigns shows by default and the hidden test runs. */
export function partitionHiddenCampaigns<T extends { id: string }>(
  campaigns: readonly T[],
  hiddenIds: ReadonlySet<string> = HIDDEN_CAMPAIGN_IDS,
): { visible: T[]; hidden: T[] } {
  const visible: T[] = []
  const hidden: T[] = []
  for (const c of campaigns) (hiddenIds.has(String(c.id)) ? hidden : visible).push(c)
  return { visible, hidden }
}
