/**
 * The platform-fee line (app-design §3.3), in one place for the host gate's cost table, the
 * wizard rail and the Review breakdown.
 *
 * Since contracts PR #26, Web3Campaigns refuses any fee module's skim above 10 % of the amount
 * it actually received (`FeeExceedsAmount`), whatever module an admin registers. Before that, the
 * 10 % ceiling lived only inside the reference FeeModule. `capEnforced` is that fact for the
 * deployment the app points at (claims.feeCapEnforced).
 *
 * Pure: no ethers, no React.
 */

/** The ceiling Web3Campaigns enforces on any fee module: received / 10. */
export const PROTOCOL_FEE_CAP_PERCENT = 10

/** 250 → "2.5%". */
export function formatFeeBps(bps: number): string {
  return `${(bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
}

/**
 * `bps`: 0 = no fee module (fees off); a number = the module's rate; null = a module is set but
 * its rate couldn't be read; undefined = still reading.
 */
export function platformFeeLine(bps: number | null | undefined, capEnforced: boolean): string {
  const cap = `the contract caps it at ${PROTOCOL_FEE_CAP_PERCENT}%`
  if (bps === undefined) return 'Checking…'
  if (bps === 0) return 'None during beta'
  if (bps === null) return capEnforced ? `Couldn’t read · ${cap}` : 'Couldn’t read'
  return capEnforced ? `${formatFeeBps(bps)} · ${cap}` : formatFeeBps(bps)
}

/** The rail's one-line note, shown only where the cap is enforced on-chain. */
export const FEE_CAP_NOTE = `The contract caps any platform fee at ${PROTOCOL_FEE_CAP_PERCENT}%.`
