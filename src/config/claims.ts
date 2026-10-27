/**
 * QW-06: the landing page's claims flags.
 *
 * Every status-dependent line on the landing page renders through these flags, so a contract
 * deployment, a founder decision or an app fix changes the page with a config PR and no copy
 * edits. Flags come from CD-resolutions §C plus CD-revisions CR-02 (landing-studio/).
 *
 * ┌───────────────────────────────────────────────────────────────────────────────────────────┐
 * │ Set to the post-redeploy state per founder decision 2026-10-07. Verify each flag against  │
 * │ the deployed contracts before merging to master (master auto-deploys to production).      │
 * └───────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The founder decided (2026-10-07) that every contract fix — PRs #23, #24, #25, the reward-module
 * rotation, the NFT-custody fix and the host-close guard — is redeployed before production, and
 * that production uses separate role wallets. So the fix flags below are `true`. Each one is
 * still a claim about the DEPLOYED contracts: before merging, check it on-chain (VERSION(),
 * hasRole(), the module addresses, the verified source) and have TRS re-check the copy it unlocks.
 * `releaseBlockers()` lists what is still unset.
 *
 * Read at build time only (no cookies(), headers() or searchParams), so `/` stays static.
 * Founder placeholders (contact, socials, faucet, LICENSE, Humanity naming…) live in
 * ./landing.ts and are re-exported here so every flag has one home.
 */
import * as landing from './landing'

export const claims = {
  // ---------------------------------------------------------------------------------------
  // The deployment the page describes.
  // ---------------------------------------------------------------------------------------

  /**
   * VERSION() of the deployed Web3Campaigns, read on-chain (0.7.0, deployed 2026-10-27).
   * null = not deployed/tagged yet; receipts then point at the verified source on the explorer,
   * never at undeployed code (D-X11).
   */
  deployVersion: '0.7.0' as string | null,
  /** Git tag in the contracts repo matching the deployed bytecode (contracts dev @ 5aa3e13). */
  deployedTag: 'v0.7.0-sepolia' as string | null,
  /**
   * Automated tests at `deployedTag`, counted by script at that tag (S2-08): `forge test` at v0.7.0-sepolia.
   * null = no number is shown. Never mix a number from one ref with a link to another (F59).
   */
  testsAtDeployed: 297 as number | null,
  /** Stateful fuzz "invariant" suites in the contracts' test/ (fact sheet §4). */
  invariantSuites: 8,
  /** ISO date the current contracts were deployed. null = line hidden. */
  contractsDeployedOn: '2026-10-27' as string | null,
  /** ISO date of the next planned contract update, or null for "pending". */
  nextContractUpdate: null as string | null,

  // ---------------------------------------------------------------------------------------
  // Contract fixes (CD-revisions CR-02). Post-redeploy values, per the founder decision.
  // ---------------------------------------------------------------------------------------

  /** PR #24: only the verifier or a contract check can complete a task (no self-marking). */
  tasksEnforcedOnChain: true,
  /** PR #23 + the global OnChainRewardModule rotated to the fixed module (SCORE qualification). */
  tierModuleFixed: true,
  /** PR #23: tiered campaigns with zero participants can be cancelled for an immediate refund. */
  tieredCancelLive: true,
  /** PR #25: SIGNER and SETTLER roles held by wallets other than the admin (check hasRole).
   * false: the Sepolia redeploy keeps ONE wallet for every role (founder decision 2026-10-27,
   * to launch fast; the split comes later). Flip only once hasRole shows separate holders. */
  rolesSplit: false,
  /** Host-close guard (OUT-C03): a host can't close a list campaign with participants and no list. */
  hostCloseGuarded: true,
  /** NFT-custody fix (OUT-C02): an NFT leaves escrow only through its own campaign. */
  nftCustodyFixed: true,
  /**
   * PR #26: Web3Campaigns itself refuses any fee module's skim above 10 % of what it received
   * (FeeExceedsAmount), so no rotated-in module can take more. Unlocks the app's "the contract
   * caps it at 10%" fee line (src/lib/protocol-fee.ts). Check: the deployed source has the cap.
   */
  feeCapEnforced: true,
  /** Commitment clause while the host-close gap is unfixed (moot once hostCloseGuarded). */
  hostCloseFixCommitted: true,
  /** Commitment clause while the NFT gap is unfixed (moot once nftCustodyFixed). */
  nftFixCommitted: true,

  // ---------------------------------------------------------------------------------------
  // App and operations (not contract fixes): plan defaults until each is shipped/confirmed.
  // ---------------------------------------------------------------------------------------

  /** OUT-A03: the campaign page shows its escrowed balance with an explorer link. Not shipped. */
  escrowBalanceOnCampaignPage: false,
  /** OUT-A01: payment tasks locked to the deployment chain. Not shipped → payment row hidden. */
  paymentTaskChainLocked: false,
  /** C7 / OUT-O07: relayer (sponsored claim gas) confirmed running in production. Unconfirmed. */
  relayerLive: false,
  /** C7 / OUT-O07: keeper (automatic end) confirmed running in production. Unconfirmed. */
  keeperLive: false,
  /** C8: an end-to-end claim confirmed on the live deployment (the C10 example run). */
  e2eClaimConfirmed: false,
  /** C11 / OUT-A05: /campaigns curated or labelled. Until then participant links stay on-page. */
  campaignsCurated: false,
  /** C16 / D12: the founder approves the security log (only "Deployed {date}" items render). */
  securityLogApproved: false,
  /**
   * C5 / O7: the pause disclosure. CD-revisions made it mandatory (G1-4), so it is always on;
   * kept as a flag because CD-resolutions §C defines it.
   */
  pauseDisclosureApproved: true,
  /** C5b / D8: the founder commits to a multisig + time delay before mainnet. Not committed. */
  adminHardeningCommitted: false,

  // ---------------------------------------------------------------------------------------
  // Founder placeholders (values live in ./landing.ts).
  // ---------------------------------------------------------------------------------------
  foundingHosts: landing.foundingHosts,
  founderContact: landing.founderContact,
  founderPublic: landing.founderPublic,
  officialLinks: landing.officialLinks,
  officialDomain: landing.officialDomain,
  licenseFile: landing.licenseFile,
  faucetUrl: landing.faucetUrl,
  testToken: landing.testToken,
  exampleCampaign: landing.exampleCampaign,
  humanityNaming: landing.humanityNaming,
  privacyNoticeUrl: landing.privacyNoticeUrl,
}

export type Claims = typeof claims

/** The four flags whose deployment defines Stage 2 (CD-revisions §2.2). */
export const STAGE_2_FLAGS = ['tasksEnforcedOnChain', 'tierModuleFixed', 'tieredCancelLive', 'rolesSplit'] as const

type StageInput = Pick<Claims, (typeof STAGE_2_FLAGS)[number]>

/**
 * Derived, never set by hand: 2 when all four redeploy flags are true, otherwise 1.
 * hostCloseGuarded and nftCustodyFixed act independently inside Stage 2.
 */
export function deriveLaunchStage<T extends StageInput>(c: T): 1 | 2 {
  return STAGE_2_FLAGS.every((k) => c[k] === true) ? 2 : 1
}

export const launchStage = deriveLaunchStage(claims)

/** CD-resolutions C4's name for the tier unlock, superseded by tierModuleFixed (CR-02). */
export const scoreTiersLive = claims.tierModuleFixed

/** FNV-1a, 32-bit: a short, stable fingerprint of the flag values. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function stableJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
    .join(',')}}`
}

/** Sent with every analytics event as `claims_version`, so before/after readings are clean. */
export function deriveClaimsVersion(c: Claims): string {
  return `s${deriveLaunchStage(c)}-${fnv1a(stableJson(c))}`
}

export const claimsVersion = deriveClaimsVersion(claims)

/**
 * What still has to be set (or verified) before this config describes production truthfully.
 * Printed by the release checklist; an empty list doesn't replace the on-chain checks.
 */
export function releaseBlockers(c: Claims = claims): string[] {
  const out: string[] = []
  if (deriveLaunchStage(c) === 2 || c.hostCloseGuarded || c.nftCustodyFixed) {
    if (!c.deployVersion) out.push('deployVersion: set to the redeployed VERSION()')
    if (!c.deployedTag) out.push('deployedTag: tag the redeployed commit in the contracts repo')
    if (c.testsAtDeployed === null) out.push('testsAtDeployed: count the tests at deployedTag')
    if (!c.contractsDeployedOn) out.push('contractsDeployedOn: set the redeploy date')
  }
  if (!c.founderContact) out.push('founderContact (D5): Stage 1 gate G1-5 wants a human channel')
  if (!c.faucetUrl && !c.testToken) out.push('faucetUrl / testToken (D6): the test kit, gate G1-6')
  if (!c.privacyNoticeUrl) out.push('privacyNoticeUrl (D11): forms stay hidden until it exists')
  return out
}
