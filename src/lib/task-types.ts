/**
 * Canonical task-type taxonomy — the SINGLE source of truth for the mapping between
 * app-facing task types, off-chain `metadata.platform`, the on-chain `TaskType` enum,
 * and the settlement path. Implements docs/DECISIONS_v0.6.0.md Decision 2.
 *
 * Rules (do not violate — see the decisions memo):
 * 1. No other module may hardcode on-chain enum numbers. Everything routes through this
 *    map via `toOnChainTaskType()` / `TASK_TYPE_MAP`.
 * 2. The on-chain enum (`CampaignStorage.TaskType`, v0.6.0) is IMMUTABLE — exactly the 10
 *    values below, in this order. New app task types are added HERE + to `metadata.platform`,
 *    mapped onto the nearest existing enum slot; never by expecting a new on-chain value.
 * 3. `metadata.platform` is authoritative for task identity, NOT the raw on-chain enum.
 *    `DISCORD_JOIN` (4) is a lossy projection shared by Discord and Telegram — the two are
 *    disambiguated only by `platform`. Indexer/analytics MUST key off `platform`, never the
 *    raw `taskType` (Decision 2, "the one rule to enforce").
 * 4. Only ONCHAIN_HOLD_ERC20 (8) and ONCHAIN_HOLD_ERC721 (9) settle via self-verify
 *    `completeTask`; every other type settles via a SIGNER_ROLE signed attestation
 *    (`verifyTaskCompletionWithSignature`). This split is enforced by the contract.
 */

/** On-chain `CampaignStorage.TaskType` enum (v0.6.0) — values are the ABI-encoded uint8. */
export enum OnChainTaskType {
  SOCIAL_FOLLOW = 0,
  SOCIAL_LIKE = 1,
  SOCIAL_RETWEET = 2,
  SOCIAL_POST = 3,
  DISCORD_JOIN = 4,
  WALLET_CONNECT = 5,
  HUMANITY_VERIFICATION = 6,
  ONCHAIN_TX = 7,
  ONCHAIN_HOLD_ERC20 = 8,
  ONCHAIN_HOLD_ERC721 = 9,
}

/** Which platform a task targets. Extensible — add new platforms here, never on-chain. */
export type TaskPlatform =
  | 'twitter'
  | 'discord'
  | 'telegram'
  | 'wallet'
  | 'humanity'
  | 'onchain'

/** How the backend confirms completion before it will settle the task. */
export type TaskSettlement = 'attestation' | 'self-verify'

/**
 * App-facing task type union. These are the identifiers the wizard, forms, DB metadata,
 * and UI use. Names are kept stable with the pre-v0.6.0 app (SOCIAL_FOLLOW, JOIN_DISCORD,
 * JOIN_TELEGRAM, RETWEET, ONCHAIN_TX, HUMANITY_VERIFICATION) so existing switch/case code
 * keeps matching; the additional types unlock the full v0.6.0 enum surface.
 */
export type TaskType =
  | 'SOCIAL_FOLLOW'
  | 'SOCIAL_LIKE'
  | 'RETWEET' // on-chain SOCIAL_RETWEET
  | 'SOCIAL_POST'
  | 'JOIN_DISCORD'
  | 'JOIN_TELEGRAM' // on-chain DISCORD_JOIN + platform="telegram"
  | 'WALLET_CONNECT'
  | 'HUMANITY_VERIFICATION'
  | 'ONCHAIN_TX'
  | 'ONCHAIN_HOLD_ERC20'
  | 'ONCHAIN_HOLD_ERC721'

export type TaskTypeSpec = {
  platform: TaskPlatform
  onChain: OnChainTaskType
  settlement: TaskSettlement
}

/** The canonical table (Decision 2). App task type → platform → on-chain enum → settlement. */
export const TASK_TYPE_MAP: Record<TaskType, TaskTypeSpec> = {
  SOCIAL_FOLLOW: { platform: 'twitter', onChain: OnChainTaskType.SOCIAL_FOLLOW, settlement: 'attestation' },
  SOCIAL_LIKE: { platform: 'twitter', onChain: OnChainTaskType.SOCIAL_LIKE, settlement: 'attestation' },
  RETWEET: { platform: 'twitter', onChain: OnChainTaskType.SOCIAL_RETWEET, settlement: 'attestation' },
  SOCIAL_POST: { platform: 'twitter', onChain: OnChainTaskType.SOCIAL_POST, settlement: 'attestation' },
  JOIN_DISCORD: { platform: 'discord', onChain: OnChainTaskType.DISCORD_JOIN, settlement: 'attestation' },
  // Telegram is a deliberate lossy projection onto DISCORD_JOIN; platform is the discriminator.
  JOIN_TELEGRAM: { platform: 'telegram', onChain: OnChainTaskType.DISCORD_JOIN, settlement: 'attestation' },
  WALLET_CONNECT: { platform: 'wallet', onChain: OnChainTaskType.WALLET_CONNECT, settlement: 'attestation' },
  HUMANITY_VERIFICATION: { platform: 'humanity', onChain: OnChainTaskType.HUMANITY_VERIFICATION, settlement: 'attestation' },
  ONCHAIN_TX: { platform: 'onchain', onChain: OnChainTaskType.ONCHAIN_TX, settlement: 'attestation' },
  ONCHAIN_HOLD_ERC20: { platform: 'onchain', onChain: OnChainTaskType.ONCHAIN_HOLD_ERC20, settlement: 'self-verify' },
  ONCHAIN_HOLD_ERC721: { platform: 'onchain', onChain: OnChainTaskType.ONCHAIN_HOLD_ERC721, settlement: 'self-verify' },
}

/** App task type → the uint8 to pass to the contract when creating the task. */
export function toOnChainTaskType(appType: TaskType): number {
  return TASK_TYPE_MAP[appType].onChain
}

/** True when the task settles via self-verify `completeTask` (holds only), else attestation. */
export function isSelfVerifyTask(appType: TaskType): boolean {
  return TASK_TYPE_MAP[appType].settlement === 'self-verify'
}

/**
 * Reverse map: on-chain enum + optional platform hint → app task type. Because DISCORD_JOIN
 * is shared by Discord and Telegram, the `platform` hint (from `metadata.platform`) is the
 * discriminator; without it, DISCORD_JOIN resolves to JOIN_DISCORD (the default community
 * bucket). Callers that have joined the off-chain metadata SHOULD pass `platform`.
 */
export function fromOnChainTaskType(
  onChain: number,
  platform?: TaskPlatform | string,
): TaskType {
  if (onChain === OnChainTaskType.DISCORD_JOIN && platform === 'telegram') {
    return 'JOIN_TELEGRAM'
  }
  const match = (Object.entries(TASK_TYPE_MAP) as [TaskType, TaskTypeSpec][]).find(
    ([, spec]) => spec.onChain === onChain,
  )
  return match ? match[0] : 'SOCIAL_FOLLOW'
}

/**
 * How the backend decides a task is done before the platform signer attests it. Every task type
 * has exactly one rule; a type with no rule is never attested (fail closed).
 *   - 'self-reported': SOCIAL_FOLLOW / SOCIAL_LIKE / RETWEET. There is no automatic X check for
 *     these, so the participant confirms it themselves. It is
 *     still only ever attested for the SIWE session wallet, and recorded as self-reported in the
 *     attestation audit log so it's never mistaken for a real check.
 *   - 'proof-by-post': SOCIAL_POST. The participant posts their personal code (+ the host's
 *     required text) and we check the public post via X's oEmbed, including its real author.
 *   - 'siwe-session': WALLET_CONNECT. The signed-in session itself proves the wallet is connected.
 *   - 'bot-membership': JOIN_DISCORD / JOIN_TELEGRAM, checked by the platform bots.
 *   - 'humanity': HUMANITY_VERIFICATION, checked against Humanity Protocol status.
 *   - 'payment': ONCHAIN_TX, only via /api/tasks/verify-payment (payment must come from the wallet).
 *   - 'contract': ONCHAIN_HOLD_*, settled by the contract itself — never attested.
 */
export type TaskVerificationMethod =
  | 'self-reported'
  | 'proof-by-post'
  | 'siwe-session'
  | 'bot-membership'
  | 'humanity'
  | 'payment'
  | 'contract'

export const TASK_VERIFICATION_METHOD: Record<TaskType, TaskVerificationMethod> = {
  SOCIAL_FOLLOW: 'self-reported',
  SOCIAL_LIKE: 'self-reported',
  RETWEET: 'self-reported',
  SOCIAL_POST: 'proof-by-post',
  WALLET_CONNECT: 'siwe-session',
  JOIN_DISCORD: 'bot-membership',
  JOIN_TELEGRAM: 'bot-membership',
  HUMANITY_VERIFICATION: 'humanity',
  ONCHAIN_TX: 'payment',
  ONCHAIN_HOLD_ERC20: 'contract',
  ONCHAIN_HOLD_ERC721: 'contract',
}

export function isSelfReportedTask(type: TaskType | string | undefined | null): boolean {
  return !!type && TASK_VERIFICATION_METHOD[type as TaskType] === 'self-reported'
}

/** Shown to hosts under a self-reported task in the wizard. */
export const SELF_REPORTED_TASK_NOTE =
  "Automatic verification is coming soon. For now, participants confirm this task themselves, so it can't stop bots on its own."
