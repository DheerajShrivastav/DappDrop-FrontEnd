/**
 * Turns a contract revert into plain language (NFR-10: a raw revert never reaches the user).
 *
 * Since contracts PR #26 the entrypoint has no string reverts left: every revert is a custom
 * error (RateLimited, InvalidTextLength, TooManyTasks, AccountFlagged, NotInActivePeriod,
 * SettlementNotPublished, …). So this decodes the revert DATA against the vendored ABIs rather
 * than matching text. ethers v6 puts that data in different places depending on the path
 * (staticCall, estimateGas through the wallet, a mined revert, a wrapped wallet error), so
 * findRevertData() walks all of them.
 *
 * Pure: no wallet, no network, no React. Unit-tested in contract-errors.test.ts with encoded
 * error data for every error in the ABIs.
 */
import { Interface, id, type ErrorDescription, type InterfaceAbi } from 'ethers'
import Web3Campaigns from './abi/Web3Campaigns.json'
import OnChainRewardModule from './abi/OnChainRewardModule.json'
import NFTSettlementModule from './abi/NFTSettlementModule.json'

/**
 * Errors the app can meet that aren't in the vendored ABIs: the FeeModule's own (only on its
 * admin calls) and OpenZeppelin v5 token errors, which SafeERC20 bubbles up from a reward token.
 */
const EXTRA_ERRORS = [
  'error FeeModule__FeeTooHigh()',
  'error FeeModule__NotAdmin()',
  'error FeeModule__ZeroAddress()',
  'error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)',
  'error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)',
  'error ERC721NonexistentToken(uint256 tokenId)',
  'error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner)',
  'error ERC721InsufficientApproval(address operator, uint256 tokenId)',
  'error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId)',
  'error ERC1155MissingApprovalForAll(address operator, address owner)',
]

type AbiItem = { type: string; name?: string; inputs?: { type: string }[] }

const ABIS: AbiItem[][] = [Web3Campaigns.abi, OnChainRewardModule.abi, NFTSettlementModule.abi] as AbiItem[][]

let errorsIface: Interface | null = null
let entrypointIface: Interface | null = null

/** Every custom error in the vendored ABIs (deduplicated: the modules redeclare some), plus EXTRA_ERRORS. */
export function contractErrorInterface(): Interface {
  if (!errorsIface) {
    const seen = new Set<string>()
    const errors: AbiItem[] = []
    for (const abi of ABIS) {
      for (const item of abi) {
        if (item.type !== 'error') continue
        const key = `${item.name}(${(item.inputs ?? []).map((i) => i.type).join(',')})`
        if (seen.has(key)) continue
        seen.add(key)
        errors.push(item)
      }
    }
    errorsIface = new Interface([...(errors as InterfaceAbi as unknown[]), ...EXTRA_ERRORS] as InterfaceAbi)
  }
  return errorsIface
}

function entrypointInterface(): Interface {
  if (!entrypointIface) entrypointIface = new Interface(Web3Campaigns.abi as InterfaceAbi)
  return entrypointIface
}

// ---------------------------------------------------------------------------------------------
// Finding the revert data
// ---------------------------------------------------------------------------------------------

const HEX = /^0x[0-9a-fA-F]*$/
const NESTED_KEYS = ['data', 'error', 'info', 'cause', 'originalError', 'revert', 'payload', 'body'] as const

/**
 * Every plausible revert payload (`0x` + at least a 4-byte selector) on an ethers v6 / wallet
 * error, nearest first: error.data, error.info.error.data, error.error.data, nested
 * `originalError`/`cause` chains, JSON bodies, and the `data="0x…"` ethers prints in messages.
 */
export function findRevertData(error: unknown): string[] {
  const out: string[] = []
  const seen = new Set<unknown>()
  const push = (s: string) => {
    if (HEX.test(s) && s.length >= 10 && s.length % 2 === 0 && !out.includes(s)) out.push(s)
  }
  const walk = (v: unknown, depth: number) => {
    if (v === null || v === undefined || depth > 6) return
    if (typeof v === 'string') {
      if (HEX.test(v)) push(v)
      else if (v.startsWith('{')) {
        try {
          walk(JSON.parse(v), depth + 1)
        } catch {
          // not JSON
        }
      }
      for (const m of v.matchAll(/data="(0x[0-9a-fA-F]+)"/g)) push(m[1])
      return
    }
    if (typeof v !== 'object' || seen.has(v)) return
    seen.add(v)
    const o = v as Record<string, unknown>
    for (const k of NESTED_KEYS) walk(o[k], depth + 1)
    if (typeof o.message === 'string') walk(o.message, depth + 1)
  }
  walk(error, 0)
  return out
}

// ---------------------------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------------------------

export type DecodedContractError = {
  /** The error's name, e.g. "Web3Campaigns__RateLimited", or "Error" / "Panic" for builtins. */
  name: string
  args: readonly unknown[]
  /** The contract function that reverted, when the error carries it (ethers invocation/tx data). */
  method: string | null
}

/** String reverts of the deployment before contracts PR #26, mapped to the custom error that replaced each. */
const LEGACY_REASONS: ReadonlyArray<[string, string]> = [
  ['Rate limit: too many actions', 'Web3Campaigns__RateLimited'],
  ['Too many rapid actions', 'Web3Campaigns__RateLimited'],
  ['Account flagged for suspicious activity', 'Web3Campaigns__AccountFlagged'],
  ['Campaign not in active period', 'Web3Campaigns__NotInActivePeriod'],
  ['Invalid name length', 'Web3Campaigns__InvalidTextLength'],
  ['Invalid description length', 'Web3Campaigns__InvalidTextLength'],
  ['Description required', 'Web3Campaigns__InvalidTextLength'],
  ['Description too long', 'Web3Campaigns__InvalidTextLength'],
  ['Too many tasks per campaign', 'Web3Campaigns__TooManyTasks'],
  ['Contract is paused', 'EnforcedPause'],
  ['Campaign not active', 'Web3Campaigns__CampaignNotOpen'],
  ['Invalid ETH amount', 'Web3Campaigns__InvalidAmount'],
]

function methodOf(error: unknown): string | null {
  const e = error as { invocation?: { method?: unknown }; transaction?: { data?: unknown } } | null
  if (typeof e?.invocation?.method === 'string') return e.invocation.method
  const data = e?.transaction?.data
  if (typeof data === 'string' && HEX.test(data) && data.length >= 10) {
    try {
      return entrypointInterface().parseTransaction({ data })?.name ?? null
    } catch {
      return null
    }
  }
  return null
}

function fromDescription(d: ErrorDescription, method: string | null): DecodedContractError {
  // A builtin Error(string) from an older deployment: map its text to the custom error that replaced it.
  if (d.name === 'Error' && typeof d.args[0] === 'string') {
    const legacy = LEGACY_REASONS.find(([text]) => (d.args[0] as string).includes(text))
    if (legacy) return { name: legacy[1], args: [], method }
  }
  return { name: d.name, args: Array.from(d.args), method }
}

/**
 * The custom error behind a failed contract call, or null when there is none to decode (wallet
 * rejection, network failure, "missing revert data", our own thrown Error).
 */
export function decodeContractError(error: unknown): DecodedContractError | null {
  if (error === null || error === undefined) return null
  const method = methodOf(error)
  const iface = contractErrorInterface()

  // 1. The revert data, wherever this path put it.
  for (const data of findRevertData(error)) {
    try {
      const d = iface.parseError(data)
      if (d) return fromDescription(d, method)
    } catch {
      // Selector known but the args didn't decode; try the next candidate.
    }
  }

  // 2. ethers already decoded it against the calling contract's ABI (error.revert).
  const revert = (error as { revert?: { name?: unknown; args?: unknown } }).revert
  if (revert && typeof revert.name === 'string') {
    const args = Array.isArray(revert.args) ? revert.args : Array.from((revert.args as Iterable<unknown>) ?? [])
    if (revert.name === 'Error' && typeof args[0] === 'string') {
      const legacy = LEGACY_REASONS.find(([text]) => (args[0] as string).includes(text))
      if (legacy) return { name: legacy[1], args: [], method }
    }
    return { name: revert.name, args, method }
  }

  // 3. Only text survived (some RPCs and wallets): a known error name, or a legacy reason string.
  const e = error as { reason?: unknown; shortMessage?: unknown; message?: unknown; error?: { message?: unknown } }
  const text = [e.reason, e.shortMessage, e.error?.message, e.message].filter((s) => typeof s === 'string').join(' ')
  if (text) {
    const named = text.match(/\b((?:Web3Campaigns|OnChainRewardModule|NFTSettlementModule|FeeModule)__[A-Za-z0-9]+)\b/)
    if (named && MESSAGES[named[1]]) return { name: named[1], args: [], method }
    if (/\bEnforcedPause\b/.test(text)) return { name: 'EnforcedPause', args: [], method }
    const legacy = LEGACY_REASONS.find(([t]) => text.includes(t))
    if (legacy) return { name: legacy[1], args: [], method }
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// Plain language
// ---------------------------------------------------------------------------------------------

type Ctx = { method: string | null; args: readonly unknown[] }
type Entry = { title: string; message: string | ((c: Ctx) => string) }

/** createCampaign's text bounds and batchAddTasks' cap are literals in the contract (no getter). */
const MAX_TASKS = 20
const HOST_ROLE = id('HOST_ROLE')

const NOT_HOST: Entry = { title: 'Only the host can do that', message: 'Only the campaign host can do this.' }
const MODULE_CHANGED: Entry = { title: 'Refresh and try again', message: 'This campaign’s settlement contract changed. Refresh the page and try again.' }
const BAD_SIGNATURE: Entry = { title: 'The check didn’t verify', message: 'The task’s verification signature isn’t valid. Check the task again.' }
const INTERNAL: Entry = { title: 'The transaction didn’t go through', message: 'This call can only come from DappDrop’s own contracts.' }

/**
 * One entry per custom error. The six named in app-design §3.2 use its exact titles and bodies;
 * every other line was checked against where the contracts throw it (fix/nft-custody-host-close).
 */
const MESSAGES: Record<string, Entry> = {
  // --- app-design §3.2: the errors that replaced string reverts in PR #26 ---------------------
  Web3Campaigns__RateLimited: {
    title: 'Too many actions in a row',
    message: ({ method }) =>
      method === 'createCampaign'
        ? 'You can create one campaign every 5 minutes. Wait a few minutes, then try again.'
        : method === 'completeTask'
          ? 'Wait 30 seconds between tasks, then try again.'
          : 'Wait a moment, then try again.',
  },
  Web3Campaigns__InvalidTextLength: {
    title: 'That text doesn’t fit',
    message: ({ method }) =>
      method === 'createCampaign'
        ? 'The campaign name is empty or longer than 200 characters. Shorten it and try again.'
        : method === 'addTaskToCampaign' || method === 'batchAddTasks'
          ? 'A task description is empty or longer than 1,000 characters. Shorten it and try again.'
          : method === 'setOffChainReward'
            ? 'The reward description is empty or longer than 500 characters. Shorten it and try again.'
            : 'It’s empty or too long. Shorten it and try again.',
  },
  Web3Campaigns__TooManyTasks: {
    title: 'Too many tasks',
    message: `A campaign can have at most ${MAX_TASKS} tasks. Remove one to continue.`,
  },
  Web3Campaigns__AccountFlagged: {
    title: 'This wallet can’t take part right now',
    // No anonymous "contact us" (landing.ts founderContact defaults to null → GitHub).
    message: 'If you think that’s a mistake, open an issue on DappDrop’s GitHub.',
  },
  Web3Campaigns__NotInActivePeriod: {
    title: 'This campaign isn’t running',
    message: 'It hasn’t started yet, or it has already ended.',
  },
  Web3Campaigns__SettlementNotPublished: {
    title: 'Can’t close yet',
    message: ({ method }) =>
      method === 'closeCampaign' || method === null
        ? 'Publish the reward list first.'
        : 'No reward list has been published for this campaign yet.',
  },

  // --- Lifecycle ------------------------------------------------------------------------------
  Web3Campaigns__CampaignNotFound: { title: 'Campaign not found', message: 'This campaign could not be found on-chain.' },
  Web3Campaigns__CampaignNotOpen: {
    title: 'This campaign isn’t open',
    message: ({ method }) =>
      method === 'endCampaign'
        ? 'This campaign isn’t open any more, so there is no end to record. Refresh the page.'
        : 'This campaign isn’t open for tasks.',
  },
  Web3Campaigns__CampaignAlreadyStarted: {
    title: 'The campaign is already open',
    message: ({ method }) =>
      method === 'openCampaign' ? 'This campaign has already been opened.' : 'This can only be changed while the campaign is still a draft.',
  },
  Web3Campaigns__CampaignAlreadyEnded: {
    title: 'The campaign is over',
    message: 'This campaign is closed or cancelled, so it can no longer be funded.',
  },
  Web3Campaigns__CampaignNotYetEnded: { title: 'Not ended yet', message: 'This works once the campaign has ended.' },
  Web3Campaigns__CampaignStartTimeNotYetStarted: {
    // Misnamed on-chain: the start time was at or before the block the transaction landed in.
    title: 'The start time has passed',
    message: 'The start time passed before the transaction confirmed. Choose a later start time and try again.',
  },
  Web3Campaigns__InvalidCampaignDuration: { title: 'Check the dates', message: 'Campaigns must run between 1 hour and 365 days.' },
  Web3Campaigns__CampaignHasParticipants: {
    title: 'Can’t cancel',
    message: 'Someone has taken part in this campaign, so it can no longer be cancelled.',
  },
  Web3Campaigns__CampaignNotCancellable: {
    title: 'Can’t cancel',
    message: 'This campaign can no longer be cancelled: its reward settlement is already committed.',
  },
  Web3Campaigns__CallerIsNotHost: NOT_HOST,
  Web3Campaigns__FallbackDelayNotElapsed: {
    title: 'Too early',
    message: 'DappDrop can only step in 14 days after the campaign ended.',
  },

  // --- Tasks and participation ---------------------------------------------------------------
  Web3Campaigns__TaskNotFound: { title: 'Task not found', message: 'This task doesn’t exist in this campaign.' },
  Web3Campaigns__TaskAlreadyCompleted: { title: 'Already done', message: 'You have already completed this task.' },
  Web3Campaigns__TaskManagedBySignature: {
    title: 'Checked by DappDrop',
    message: 'DappDrop’s verifier records this task, not a wallet transaction.',
  },
  Web3Campaigns__TaskNotVerifiableByHost: {
    title: 'Checked on-chain',
    message: 'This task is checked on-chain from your wallet, so it can’t be verified any other way.',
  },
  Web3Campaigns__NotSelfVerifiable: {
    title: 'Checked by DappDrop',
    message: 'This task is checked by DappDrop’s verifier, not by a wallet transaction. Use the task’s Start button.',
  },
  Web3Campaigns__InvalidVerificationData: {
    title: 'This task is misconfigured',
    message: 'The task’s on-chain check is set up wrong, so it can’t be completed. Tell the host.',
  },
  Web3Campaigns__InsufficientERC20Balance: {
    title: 'Not enough tokens',
    message: 'This wallet doesn’t hold enough of the required token yet.',
  },
  Web3Campaigns__NotHoldingSpecificERC721: {
    title: 'NFT not held',
    message: 'This wallet doesn’t hold the required NFT.',
  },
  Web3Campaigns__ParticipantLimitReached: {
    title: 'This campaign is full',
    message: 'This campaign has reached its participant limit.',
  },
  Web3Campaigns__InvalidSigner: BAD_SIGNATURE,
  Web3Campaigns__SignatureExpired: {
    title: 'The check expired',
    message: 'The task’s verification expired before it was recorded. Check the task again.',
  },
  Web3Campaigns__ZeroAddress: { title: 'Missing address', message: 'An address was empty. Check it and try again.' },

  // --- Rewards: configuration and funding -----------------------------------------------------
  Web3Campaigns__InvalidTokenAddress: { title: 'Check the token', message: 'That token address is not valid for this reward.' },
  Web3Campaigns__NotAContract: { title: 'Check the token', message: 'There is no token contract at that address on this network.' },
  Web3Campaigns__InvalidAmount: { title: 'Check the amount', message: 'The amount must be greater than zero.' },
  Web3Campaigns__FeeExceedsAmount: {
    title: 'Fee refused',
    message: 'The contract refused the platform fee: it can never take more than 10% of what you fund.',
  },
  Web3Campaigns__NoFundsReceived: {
    title: 'No tokens arrived',
    message: 'No tokens were received. Check your token balance and approval, then try again.',
  },
  Web3Campaigns__InvalidFeeTreasury: { title: 'Fee setup problem', message: 'The platform fee setup is broken, so funding is refused for now. Try again later.' },
  Web3Campaigns__InvalidParticipantLimit: { title: 'Check the cap', message: 'That participant cap is not allowed.' },
  Web3Campaigns__TooManyTiers: { title: 'Check the tiers', message: 'Use between 1 and 10 reward tiers.' },
  Web3Campaigns__InvalidTierConfiguration: {
    title: 'Check the tiers',
    message: 'The reward tiers are invalid: rank tiers must not overlap, and score tiers need different minimum scores.',
  },
  Web3Campaigns__ArrayLengthMismatch: { title: 'Check the lists', message: 'Token IDs and amounts must have the same number of entries.' },
  Web3Campaigns__BatchTooLarge: { title: 'Too many at once', message: 'Too many items in one transaction. Try a smaller batch.' },
  Web3Campaigns__ERC20RewardNotConfigured: { title: 'No token reward', message: 'This campaign has no token reward set up yet.' },
  Web3Campaigns__SettlementModeAlreadySet: {
    title: 'Payout already chosen',
    message: 'This campaign is already set to pay out a different way.',
  },

  // --- Rewards: the list, claims and sweeping -------------------------------------------------
  Web3Campaigns__MerkleRootNotSet: { title: 'No list yet', message: 'No reward list has been published for this campaign yet.' },
  Web3Campaigns__RootAlreadyPublished: {
    title: 'A list already exists',
    message: 'A reward list is already published for this campaign. The host can still publish a corrected one.',
  },
  Web3Campaigns__RootDisputeWindowActive: {
    title: 'The list is in review',
    message: 'The reward list was just published and is in its 24-hour public review. Claims open when it ends.',
  },
  Web3Campaigns__InvalidMerkleProof: {
    title: 'Not on the list',
    message: 'This wallet isn’t on the reward list, or the list changed. Refresh the page and try again.',
  },
  Web3Campaigns__AlreadyClaimedSettlement: { title: 'Already claimed', message: 'This wallet has already claimed its reward for this campaign.' },
  Web3Campaigns__AlreadySwept: {
    title: 'Claiming has ended',
    message: 'The claim period is over and the host took back what was left.',
  },
  Web3Campaigns__InsufficientEscrow: {
    title: 'Not enough in escrow',
    message: 'This campaign’s escrow can’t cover this claim. Tell the host.',
  },
  Web3Campaigns__WrongSettlementMode: {
    title: 'Wrong claim type',
    message: 'This campaign pays out a different way. Refresh the page and try again.',
  },
  Web3Campaigns__NotFullyCompleted: {
    title: 'Not eligible yet',
    message: 'You haven’t completed every required task for this campaign.',
  },
  Web3Campaigns__NoTierMatched: { title: 'No reward tier', message: 'Your rank or score doesn’t reach a reward tier.' },
  Web3Campaigns__GracePeriodActive: {
    title: 'Too early',
    message: 'What’s unclaimed can only be taken back once the 30-day claim period is over.',
  },
  Web3Campaigns__NothingToSweep: { title: 'Nothing left', message: 'Everything has been claimed; there is nothing left to take back.' },
  Web3Campaigns__NFTNotEscrowed: {
    title: 'NFT not in escrow',
    message: 'This NFT isn’t held for this campaign (it was already claimed or withdrawn).',
  },
  Web3Campaigns__NFTModuleMismatch: MODULE_CHANGED,
  Web3Campaigns__RewardModuleMismatch: MODULE_CHANGED,
  Web3Campaigns__NotOnChainRewardModule: INTERNAL,
  Web3Campaigns__TransferFailed: { title: 'Transfer failed', message: 'The ETH transfer failed.' },
  Web3Campaigns__TreasuryNotSet: { title: 'Treasury not set', message: 'Set a treasury address first.' },

  // --- Satellite modules ----------------------------------------------------------------------
  OnChainRewardModule__CampaignAlreadyStarted: {
    title: 'The campaign is already open',
    message: 'Reward tiers can only be set while the campaign is still a draft.',
  },
  OnChainRewardModule__NotAuthoritativeModule: MODULE_CHANGED,
  OnChainRewardModule__NotCampaignHost: NOT_HOST,
  OnChainRewardModule__NotWeb3Campaigns: INTERNAL,
  NFTSettlementModule__NotAuthoritativeModule: MODULE_CHANGED,
  NFTSettlementModule__NotCampaignHost: NOT_HOST,
  NFTSettlementModule__NotWeb3Campaigns: INTERNAL,
  FeeModule__FeeTooHigh: { title: 'Fee too high', message: 'The platform fee can’t be set above 10%.' },
  FeeModule__NotAdmin: { title: 'Not allowed', message: 'Only the fee admin can change the platform fee.' },
  FeeModule__ZeroAddress: { title: 'Missing address', message: 'An address was empty. Check it and try again.' },

  // --- OpenZeppelin (in the entrypoint's ABI) -------------------------------------------------
  EnforcedPause: { title: 'DappDrop is paused', message: 'DappDrop is paused for maintenance. Try again later.' },
  ExpectedPause: { title: 'Not paused', message: 'This only works while DappDrop is paused.' },
  AccessControlUnauthorizedAccount: {
    title: 'This wallet can’t do that',
    message: ({ args }) =>
      typeof args[1] === 'string' && args[1].toLowerCase() === HOST_ROLE
        ? 'This wallet doesn’t have the host role yet. Get it on the New campaign page first.'
        : 'This wallet doesn’t have the permission this needs.',
  },
  AccessControlBadConfirmation: { title: 'Not allowed', message: 'Only the wallet that holds a role can give it up.' },
  ECDSAInvalidSignature: BAD_SIGNATURE,
  ECDSAInvalidSignatureLength: BAD_SIGNATURE,
  ECDSAInvalidSignatureS: BAD_SIGNATURE,
  ReentrancyGuardReentrantCall: { title: 'Blocked', message: 'The contract blocked a nested call. Try again.' },
  SafeERC20FailedOperation: {
    title: 'Token transfer failed',
    message: 'The token transfer didn’t go through. Check your balance and approval, then try again.',
  },
  InvalidShortString: { title: 'Text too long', message: 'A text value is too long for the contract.' },
  StringTooLong: { title: 'Text too long', message: 'A text value is too long for the contract.' },

  // --- OpenZeppelin token errors (bubbled up from a reward token) ----------------------------
  ERC20InsufficientBalance: { title: 'Not enough tokens', message: 'This wallet doesn’t hold enough of the reward token.' },
  ERC20InsufficientAllowance: {
    title: 'Approval too low',
    message: 'The token approval is lower than the amount. Approve the full amount, then try again.',
  },
  ERC721NonexistentToken: { title: 'NFT not found', message: 'One of those NFT token IDs doesn’t exist.' },
  ERC721IncorrectOwner: { title: 'NFT not yours', message: 'This wallet doesn’t own one of those NFTs.' },
  ERC721InsufficientApproval: { title: 'Approval missing', message: 'Approve DappDrop to move these NFTs, then try again.' },
  ERC1155InsufficientBalance: { title: 'Not enough NFTs', message: 'This wallet doesn’t hold enough of one of those NFTs.' },
  ERC1155MissingApprovalForAll: { title: 'Approval missing', message: 'Approve DappDrop to move these NFTs, then try again.' },
}

/** Names this module has a specific message for (the unit test checks it covers every ABI error). */
export const KNOWN_CONTRACT_ERRORS: readonly string[] = Object.keys(MESSAGES)

export type ContractErrorDescription = {
  /** The decoded error name, or null when the failure wasn't a decodable revert. */
  name: string | null
  /** A short toast title (sentence case, no "Error"). */
  title: string
  /** The plain-language explanation. */
  message: string
}

const GENERIC_TITLE = 'The transaction didn’t go through'

function describeBuiltin(d: DecodedContractError): ContractErrorDescription {
  if (d.name === 'Panic') {
    return {
      name: 'Panic',
      title: GENERIC_TITLE,
      message:
        BigInt(String(d.args[0] ?? 0)) === BigInt(0x11) && /NFT|ERC721|ERC1155/i.test(d.method ?? '')
          ? 'Those NFTs aren’t held for this campaign.'
          : 'The contract refused it: one of its safety checks failed.',
    }
  }
  // An Error(string) we don't recognise: never show the raw string.
  return { name: d.name, title: GENERIC_TITLE, message: 'The contract refused it.' }
}

/** Plain-language title + message for any failed contract call. Never returns raw revert text. */
export function describeContractError(error: unknown, opts: { gasSymbol?: string } = {}): ContractErrorDescription {
  const decoded = decodeContractError(error)
  if (decoded) {
    const entry = MESSAGES[decoded.name]
    if (entry) {
      const message = typeof entry.message === 'function' ? entry.message({ method: decoded.method, args: decoded.args }) : entry.message
      return { name: decoded.name, title: entry.title, message }
    }
    return describeBuiltin(decoded)
  }

  // Not a revert we can decode.
  const e = (error ?? {}) as {
    code?: unknown
    message?: unknown
    shortMessage?: unknown
    info?: { error?: { code?: unknown } }
    error?: { code?: unknown }
  }
  const code = e.code ?? e.info?.error?.code ?? e.error?.code
  const text = `${String(e.shortMessage ?? '')} ${String(e.message ?? '')}`.toLowerCase()
  if (code === 'ACTION_REJECTED' || code === 4001 || text.includes('user rejected') || text.includes('user denied')) {
    return { name: null, title: 'Cancelled in your wallet', message: 'You cancelled in your wallet. Nothing was sent.' }
  }
  if (code === 'INSUFFICIENT_FUNDS' || text.includes('insufficient funds')) {
    return {
      name: null,
      title: 'Not enough for gas',
      message: `This wallet doesn’t have enough ${opts.gasSymbol ?? 'ETH'} to pay for gas.`,
    }
  }
  if (code === 'CALL_EXCEPTION') {
    return { name: null, title: GENERIC_TITLE, message: 'The contract refused it. Refresh the page to check the campaign’s current state, then try again.' }
  }
  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code === 'SERVER_ERROR') {
    return { name: null, title: GENERIC_TITLE, message: 'The network didn’t answer. Try again in a moment.' }
  }
  // Our own thrown Error (a pre-check or a service message) is already plain language.
  if (typeof code !== 'string' && typeof e.message === 'string' && e.message.trim()) {
    return { name: null, title: GENERIC_TITLE, message: e.message }
  }
  return { name: null, title: GENERIC_TITLE, message: 'Transaction failed. Please try again.' }
}

/** describeContractError(...).message, for call sites that only show a line of text. */
export function contractErrorMessage(error: unknown, opts?: { gasSymbol?: string }): string {
  return describeContractError(error, opts).message
}

/** The decoded error name (e.g. "Web3Campaigns__CampaignNotOpen"), or null. For control flow in workers. */
export function contractErrorName(error: unknown): string | null {
  return decodeContractError(error)?.name ?? null
}
