import { ethers, BrowserProvider, Contract, Eip1193Provider } from 'ethers'
import { toast } from '@/hooks/use-toast'
import type {
  Campaign,
  CampaignSettlement,
  ParticipantData,
  SettlementMode,
  TaskType,
} from './types'
import { fromOnChainTaskType, toOnChainTaskType, OnChainTaskType } from './task-types'
import config from '@/app/config'
import Web3Campaigns from './abi/Web3Campaigns.json'
import OnChainRewardModule from './abi/OnChainRewardModule.json'
import NFTSettlementModule from './abi/NFTSettlementModule.json'
import { addDays, endOfDay, differenceInSeconds } from 'date-fns'
import { contractErrorMessage, contractErrorName } from './contract-errors'
import { DEPLOYMENT_CHAIN } from './deployment-chain'
import { settlementOwedOnClose } from './close-guard'
import {
  getGraphCampaigns,
  getGraphCampaignsByHost,
  getGraphParticipantAddresses,
  getGraphParticipants,
} from './graph-service'

// Extend the Window interface to include ethereum
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean
      request: (...args: any[]) => Promise<any>
      providers?: (Eip1193Provider & { isMetaMask?: boolean })[]
    }
  }
}

// --- Ethers Setup ---
let provider: BrowserProvider | null = null
let contract: Contract | null = null
let readOnlyContract: Contract | null = null

const PARTICIPANT_CACHE_TTL_MS = 30 * 1000
const PARTICIPANT_DETAIL_CACHE_TTL_MS = 30 * 1000
const PARTICIPATION_CACHE_TTL_MS = 30 * 1000
const MAX_LOG_RANGE_FALLBACK = 2000
const PARTICIPANT_QUERY_CONCURRENCY = 3
const PAUSED_CACHE_TTL_MS = 30 * 1000
const HOST_ROLE_CACHE_TTL_MS = 30 * 1000

type ParticipantAddressCacheEntry = {
  addresses: string[]
  lastBlock: number
  updatedAt: number
  inFlight?: Promise<string[]>
}

type ParticipantDetailsCacheEntry = {
  data: ParticipantData[]
  updatedAt: number
  inFlight?: Promise<ParticipantData[]>
}

type ParticipationCacheEntry = {
  value: boolean
  updatedAt: number
  inFlight?: Promise<boolean>
}

const participantAddressesCache = new Map<
  string,
  ParticipantAddressCacheEntry
>()
const participantDetailsCache = new Map<string, ParticipantDetailsCacheEntry>()
const participationCache = new Map<string, ParticipationCacheEntry>()
const hostRoleCache = new Map<string, ParticipationCacheEntry>()
let pausedCache: ParticipationCacheEntry | null = null

const TARGET_CHAIN_ID = `0x${config.chainId.toString(16)}`
const TARGET_RPC_URL = config.rpcUrl

const initializeReadOnlyProvider = () => {
  if (readOnlyContract) return
  try {
    const rpcProvider = new ethers.JsonRpcProvider(TARGET_RPC_URL)
    if (config.campaignFactoryAddress) {
      readOnlyContract = new ethers.Contract(
        config.campaignFactoryAddress,
        Web3Campaigns.abi,
        rpcProvider,
      )
    }
  } catch (e) {
    console.error('Failed to initialize read-only provider', e)
  }
}

const getReadOnlyContract = () => {
  if (!readOnlyContract) {
    initializeReadOnlyProvider()
  }
  return readOnlyContract
}

export const initializeProviderAndContract = (
  walletProvider?: Eip1193Provider,
) => {
  if (walletProvider) {
    provider = new ethers.BrowserProvider(walletProvider)
    if (config.campaignFactoryAddress) {
      contract = new ethers.Contract(
        config.campaignFactoryAddress,
        Web3Campaigns.abi,
        provider,
      )
    } else {
      contract = null
    }
  } else {
    initializeReadOnlyProvider()
  }
}
// Initial call for read-only access
initializeReadOnlyProvider()

/** The signer-backed BrowserProvider for the connected wallet, or null before
 * initializeProviderAndContract has run. Exposed so callers that need a provider for
 * NON-contract work (SIWE message signing in the wallet context) reuse this one instance
 * instead of constructing `new BrowserProvider(...)` themselves — CLAUDE.md keeps ethers out
 * of components, and a second provider over the same transport is pure duplication anyway. */
export const getWalletBrowserProvider = (): BrowserProvider | null => provider

// --- Helper Functions ---

const getSigner = async () => {
  if (!provider) {
    toast({
      variant: 'destructive',
      title: 'Wallet not connected',
      description: 'Please connect your wallet.',
    })
    throw new Error('Wallet not connected')
  }
  const signer = await provider.getSigner()
  return signer
}

// Exported as runWithConcurrencyPublic for reuse by server-side analytics aggregation
// (src/lib/campaign-funnel.ts) — same bounded-concurrency helper the participant-detail fetch
// already uses internally, not a duplicate implementation.
export const runWithConcurrencyPublic = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => runWithConcurrency(items, limit, worker)

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) return []

  const results: R[] = new Array(items.length)
  let nextIndex = 0

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const currentIndex = nextIndex
        nextIndex += 1
        if (currentIndex >= items.length) return
        results[currentIndex] = await worker(items[currentIndex], currentIndex)
      }
    },
  )

  await Promise.all(runners)
  return results
}

const mapContractDataToCampaign = (
  contractData: any,
  id: number,
  taskMetadata?: Array<{ taskIndex: number; discordInviteLink?: string }>,
  imageUrl?: string,
  campaignMetadata?: {
    shortDescription?: string | null
    longDescription?: string | null
    rewardName?: string | null
  },
): Campaign => {
  const statusMap = ['Draft', 'Open', 'Ended', 'Closed', 'Cancelled']

  // v0.6.0: on-chain task type is an advisory uint8; the app type is resolved through the
  // canonical taxonomy (docs/DECISIONS_v0.6.0.md Decision 2). DISCORD_JOIN is shared by
  // Discord and Telegram — the platform discriminator comes from off-chain metadata, which
  // is joined later in getCampaignByIdWithMetadata. Without it we default to JOIN_DISCORD.
  // TODO(P0): thread metadata.platform in here so Telegram tasks resolve to JOIN_TELEGRAM
  // at map time rather than only after the metadata enrichment pass.

  // Reward data is no longer on-chain (the `reward` struct field was removed in v0.6.0).
  // Use the stored reward name/type from off-chain metadata.
  // No invented copy: when the off-chain metadata is missing these stay empty, and the UI
  // shows nothing (description, image) or the honest state (reward) instead.
  const rewardName = campaignMetadata?.rewardName || ''
  const shortDescription = campaignMetadata?.shortDescription || ''
  const longDescription = campaignMetadata?.longDescription || ''

  // Use the actual dates from the blockchain
  let startDate = new Date(Number(contractData.startTime) * 1000)
  let endDate = new Date(Number(contractData.endTime) * 1000)

  const contractStatus = Number(contractData.status)
  const mappedStatus = statusMap[contractStatus]

  console.log('Campaign status mapping:', {
    campaignId: id,
    contractStatus,
    mappedStatus,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    now: new Date().toISOString(),
  })

  return {
    id: id.toString(),
    title: contractData.name,
    description: shortDescription,
    longDescription: longDescription,
    startDate,
    endDate,
    status: statusMap[Number(contractData.status)] as
      | 'Draft'
      | 'Open'
      | 'Ended'
      | 'Closed'
      | 'Cancelled',
    participants: Number(contractData.totalParticipants),
    host: contractData.host,
    tasks: contractData.tasks.map((task: any, index: number) => {
      let verificationDataString = ''

      if (
        task.verificationData &&
        ethers.isBytesLike(task.verificationData) &&
        task.verificationData.length === 66
      ) {
        try {
          verificationDataString = ethers.decodeBytes32String(
            task.verificationData,
          )
        } catch (e) {
          console.error('Failed to decode bytes32 string:', e)
        }
      }

      // For Discord tasks, try to load invite link from task metadata
      let discordInviteLink = ''
      if (fromOnChainTaskType(Number(task.taskType)) === 'JOIN_DISCORD') {
        if (taskMetadata && Array.isArray(taskMetadata)) {
          const metadata = taskMetadata.find((tm) => tm.taskIndex === index)
          if (metadata && metadata.discordInviteLink) {
            discordInviteLink = metadata.discordInviteLink
            console.log(
              `Found Discord invite link for task ${index}:`,
              discordInviteLink,
            )
          } else {
            console.warn(
              `No Discord invite link found for task ${index} in campaign ${id}`,
            )
          }
        } else {
          console.warn(`No task metadata available for campaign ${id}`)
        }
      }

      return {
        id: index.toString(),
        type: fromOnChainTaskType(Number(task.taskType)) as TaskType,
        description: task.description,
        verificationData: verificationDataString,
        isOptional: Boolean(task.isOptional),
        discordInviteLink: discordInviteLink || undefined,
      }
    }),
    // v0.6.0: reward data comes from off-chain metadata, not the on-chain struct.
    // TODO(P1): populate type/tokenAddress/amount from the settlement views
    // (getERC20Settlement / NFT module escrow / tiered module) per docs/REWARD_SYSTEM.md.
    reward: {
      type: (campaignMetadata as { rewardType?: 'ERC20' | 'ERC721' | 'None' })
        ?.rewardType || 'None',
      tokenAddress: '',
      amount: undefined,
      name: rewardName,
    },
    imageUrl: imageUrl || '',
  }
}

const switchOrAddTargetNetwork = async (ethereum: Eip1193Provider) => {
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: TARGET_CHAIN_ID }],
    })
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: TARGET_CHAIN_ID,
              chainName:
                config.chainId === 9998453
                  ? 'Tenderly Base Virtual'
                  : 'Target Network',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [TARGET_RPC_URL],
            },
          ],
        })
      } catch (addError) {
        console.error('Failed to add network:', addError)
        toast({
          variant: 'destructive',
          title: 'Network Error',
          description: 'Failed to add target network to your wallet.',
        })
        throw addError
      }
    } else {
      console.error('Failed to switch to target network:', switchError)
      toast({
        variant: 'destructive',
        title: 'Network Error',
        description: 'Please switch to the correct network in your wallet.',
      })
      throw switchError
    }
  }
}

// Helper function to fetch task metadata from database
const fetchTaskMetadata = async (campaignId: string) => {
  // Only fetch in browser environment, not during SSR
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const response = await fetch(
      `/api/campaign-task-metadata?campaignId=${campaignId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    if (response.ok) {
      const result = await response.json()
      if (result.success && Array.isArray(result.data)) {
        console.log(
          `Fetched task metadata for campaign ${campaignId}:`,
          result.data,
        )
        return result.data
      } else {
        console.warn(`No task metadata found for campaign ${campaignId}`)
      }
    } else {
      console.warn(
        `Failed to fetch task metadata for campaign ${campaignId}:`,
        response.status,
        response.statusText,
      )
    }
  } catch (e) {
    console.warn('Failed to fetch task metadata from database:', e)
  }
  return []
}

// --- Service Functions ---

export const connectWallet = async (): Promise<string | null> => {
  if (typeof window.ethereum === 'undefined') {
    toast({
      variant: 'destructive',
      title: 'MetaMask Not Found',
      description:
        'Please install a wallet extension like MetaMask to use this dApp.',
    })
    return null
  }

  let selectedProvider: (Eip1193Provider & { isMetaMask?: boolean }) | null =
    null

  if (window.ethereum.providers) {
    selectedProvider =
      window.ethereum.providers.find((p) => p.isMetaMask) ??
      window.ethereum.providers[0]
  } else {
    selectedProvider = window.ethereum
  }

  if (!selectedProvider) {
    toast({
      variant: 'destructive',
      title: 'No Wallet Found',
      description: 'Could not detect a wallet provider.',
    })
    return null
  }

  try {
    await switchOrAddTargetNetwork(selectedProvider)
    const accounts = await selectedProvider.request({
      method: 'eth_requestAccounts',
    })

    initializeProviderAndContract(selectedProvider)

    return accounts[0] || null
  } catch (error) {
    console.error('Error connecting to wallet:', error)
    if ((error as any).code !== 4001) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: 'Could not connect to wallet.',
      })
    }
    return null
  }
}

/**
 * Optional, additive (08-site phase 2, Builder B): `onError` lets a page show its own in-place
 * error state ("We couldn't load campaigns" + Try again) instead of the toast. Without it the
 * behaviour is unchanged (the toast, then an empty list).
 */
export type CampaignListLoadOptions = { onError?: (reason: string) => void }

export const getAllCampaigns = async (opts: CampaignListLoadOptions = {}): Promise<Campaign[]> => {
  // --- Fast path: The Graph subgraph (single query, no N+1 RPC calls) ---
  const graphResult = await getGraphCampaigns()
  if (graphResult !== null) {
    return graphResult
  }

  // --- Fallback: direct RPC (original behaviour when Graph is not configured) ---
  const contractToUse = readOnlyContract
  if (!contractToUse) {
    console.warn('Contract not initialized, trying to initialize read-only...')
    initializeReadOnlyProvider()
    if (!readOnlyContract) {
      if (opts.onError) {
        opts.onError('Could not connect to the campaign contract.')
        return []
      }
      toast({
        variant: 'destructive',
        title: 'Contract Error',
        description:
          'Could not connect to the campaign contract. Please check your configuration and network.',
      })
      return []
    }
    return getAllCampaigns(opts)
  }

  try {
    const campaignCountBigInt = await contractToUse.getCampaignCount()
    const campaignCount = Number(campaignCountBigInt)

    if (campaignCount === 0) return []

    const campaigns = []
    for (let i = 1; i <= campaignCount; i++) {
      try {
        const campaignData = await contractToUse.getCampaign(i)
        if (Number(campaignData.status) !== 3) {
          let imageUrl: string | undefined
          let campaignMeta:
            | {
                shortDescription?: string
                longDescription?: string
                rewardName?: string
              }
            | undefined
          let hiddenFromDiscovery = false
          if (typeof window !== 'undefined') {
            try {
              const imageResponse = await fetch(`/api/campaigns/${i}/image`)
              if (imageResponse.ok) {
                const imageData = await imageResponse.json()
                imageUrl = imageData.imageUrl
                hiddenFromDiscovery = Boolean(imageData.hiddenFromDiscovery)
                if (
                  imageData.shortDescription ||
                  imageData.longDescription ||
                  imageData.rewardName
                ) {
                  campaignMeta = {
                    shortDescription: imageData.shortDescription,
                    longDescription: imageData.longDescription,
                    rewardName: imageData.rewardName,
                  }
                }
              }
            } catch (e) {
              // Silently fail if image fetch fails
            }
          }

          // P3 CP4: public discovery excludes admin-hidden campaigns (off-chain only —
          // getCampaignsByHostAddress's RPC fallback does NOT apply this filter, so a host
          // still sees their own hidden campaign on their dashboard).
          if (!hiddenFromDiscovery) {
            const campaign = mapContractDataToCampaign(
              campaignData,
              i,
              undefined,
              imageUrl,
              campaignMeta,
            )

            campaigns.push(campaign)
          }
        }
      } catch (error: any) {
        if (error?.code === 'BAD_DATA' || error?.code === 'CALL_EXCEPTION') {
          console.warn(`Campaign ${i} not found on blockchain or reverted.`)
        } else {
          console.warn(
            `Failed to fetch campaign ${i}:`,
            error?.message || 'Unknown error',
          )
        }
      }
    }
    return campaigns.filter((c) => c.status === 'Open' || c.status === 'Ended')
  } catch (error: any) {
    if (error.code === 'CALL_EXCEPTION') {
      console.error(
        'Contract call failed. Check contract address and network.',
        error,
      )
      if (opts.onError) {
        opts.onError('The campaign contract call failed.')
        return []
      }
      toast({
        variant: 'destructive',
        title: 'Contract Error',
        description:
          'Could not connect to the campaign contract. Please check your configuration and network.',
      })
    } else {
      console.error('Error fetching campaigns:', error)
      if (opts.onError) {
        opts.onError('The campaign data could not be fetched.')
        return []
      }
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not fetch campaign data.',
      })
    }
    return []
  }
}

export const getCampaignsByHostAddress = async (
  hostAddress: string,
  opts: CampaignListLoadOptions = {},
): Promise<Campaign[]> => {
  // --- Fast path: The Graph subgraph ---
  const graphResult = await getGraphCampaignsByHost(hostAddress)
  if (graphResult !== null) {
    return graphResult
  }

  // --- Fallback: direct RPC ---
  const contractToUse = readOnlyContract ?? contract
  if (!contractToUse) {
    console.warn('Contract not initialized for getting host campaigns.')
    return []
  }

  try {
    const campaignIdsBigInt: bigint[] =
      await contractToUse.getCampaignsByHost(hostAddress)
    const campaignIds = campaignIdsBigInt.map((id) => Number(id))

    if (campaignIds.length === 0) return []

    const campaigns = await runWithConcurrency(campaignIds, 4, async (id) => {
      try {
        const campaignData = await contractToUse.getCampaign(id)

        let imageUrl: string | undefined
        let campaignMeta:
          | {
              shortDescription?: string
              longDescription?: string
              rewardName?: string
            }
          | undefined
        if (typeof window !== 'undefined') {
          try {
            const imageResponse = await fetch(`/api/campaigns/${id}/image`)
            if (imageResponse.ok) {
              const imageData = await imageResponse.json()
              imageUrl = imageData.imageUrl
              if (
                imageData.shortDescription ||
                imageData.longDescription ||
                imageData.rewardName
              ) {
                campaignMeta = {
                  shortDescription: imageData.shortDescription,
                  longDescription: imageData.longDescription,
                  rewardName: imageData.rewardName,
                }
              }
            }
          } catch (e) {
            // Silently fail if image fetch fails
          }
        }

        const campaign = mapContractDataToCampaign(
          campaignData,
          id,
          undefined,
          imageUrl,
          campaignMeta,
        )

        return campaign
      } catch (error: any) {
        if (error?.code === 'BAD_DATA' || error?.code === 'CALL_EXCEPTION') {
          console.warn(
            `Campaign ${id} not found for host ${hostAddress} (reverted).`,
          )
        } else {
          console.warn(
            `Failed to fetch campaign ${id} for host ${hostAddress}:`,
            error?.message || 'Unknown error',
          )
        }
        return null
      }
    })

    return campaigns.filter((c): c is Campaign => c !== null)
  } catch (error) {
    console.error(`Error fetching campaigns for host ${hostAddress}:`, error)
    if (opts.onError) {
      opts.onError('Your campaigns could not be fetched.')
      return []
    }
    toast({
      variant: 'destructive',
      title: 'Error',
      description: 'Could not fetch your campaigns.',
    })
    return []
  }
}

export const getCampaignById = async (id: string): Promise<Campaign | null> => {
  const campaignId = parseInt(id, 10)
  if (isNaN(campaignId)) return null

  let contractToUse = contract ?? readOnlyContract

  // If no contract is available, try to initialize read-only provider
  if (!contractToUse) {
    console.warn('No contract available, initializing read-only provider...')
    initializeReadOnlyProvider()
    contractToUse = readOnlyContract
  }

  if (!contractToUse) {
    console.warn('Neither wallet contract nor read-only contract is available.')
    return null
  }

  try {
    console.log(`Fetching campaign ${id} from blockchain...`)
    const campaignData = await contractToUse.getCampaign(id)
    console.log(`Raw campaign data for ${id}:`, {
      id: campaignData.id.toString(),
      status: campaignData.status.toString(),
      statusNumber: Number(campaignData.status),
      name: campaignData.name,
      host: campaignData.host,
      startTime: Number(campaignData.startTime),
      endTime: Number(campaignData.endTime),
      totalParticipants: Number(campaignData.totalParticipants),
    })

    // Fetch image URL and metadata from database if available
    let imageUrl: string | undefined
    let campaignMeta:
      | {
          shortDescription?: string
          longDescription?: string
          rewardName?: string
        }
      | undefined
    if (typeof window !== 'undefined') {
      try {
        const imageResponse = await fetch(`/api/campaigns/${id}/image`)

        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          imageUrl = imageData.imageUrl
          if (
            imageData.shortDescription ||
            imageData.longDescription ||
            imageData.rewardName
          ) {
            campaignMeta = {
              shortDescription: imageData.shortDescription,
              longDescription: imageData.longDescription,
              rewardName: imageData.rewardName,
            }
          }
        } else {
          console.warn(
            `⚠️ Image API returned non-OK status: ${imageResponse.status}`,
          )
        }
      } catch (e) {
        console.error('❌ Failed to fetch image:', e)
        // Silently fail if image fetch fails
      }
    }

    const campaign = mapContractDataToCampaign(
      campaignData,
      parseInt(id),
      undefined,
      imageUrl,
      campaignMeta,
    )
    console.log(`Mapped campaign data for ${id}:`, {
      id: campaign.id,
      status: campaign.status,
      title: campaign.title,
      host: campaign.host,
      participants: campaign.participants,
      imageUrl: campaign.imageUrl,
    })

    return campaign
  } catch (error: any) {
    if (error?.code === 'BAD_DATA' || error?.code === 'CALL_EXCEPTION') {
      console.warn(`Campaign ${id} not found on blockchain or reverted.`)
    } else {
      console.warn(
        `Error fetching campaign ${id}:`,
        error?.message || 'Unknown error',
      )
    }
    return null
  }
}

/**
 * Construct a Web3Campaigns entrypoint Contract bound to an arbitrary runner (a
 * JsonRpcProvider for reads, or a Wallet for signing/sending). This is the single place
 * outside this module's own client-side `contract`/`readOnlyContract` singletons that ABI +
 * address wiring happens — server-only services (e.g. src/lib/signer.ts) MUST go through
 * this instead of constructing `new ethers.Contract(...)` themselves, per this repo's
 * "never instantiate a Contract outside web3-service.ts" convention (CLAUDE.md).
 */
export const getEntrypointContract = (
  runner: ethers.ContractRunner,
): Contract => new ethers.Contract(config.addresses.entrypoint, Web3Campaigns.abi, runner) as Contract

/**
 * The shared read-only entrypoint contract (server- and client-safe), initializing the
 * module-level read-only provider on first use if needed. For server callers that only need
 * view calls (e.g. the signer service reading task type / attestation version).
 */
export const getEntrypointReadContract = (): Contract => {
  const c = getReadOnlyContract()
  if (!c) throw new Error('Read-only contract could not be initialized')
  return c
}

/**
 * Construct an OnChainRewardModule Contract bound to an arbitrary runner AND an explicit
 * module address — deliberately no default/global fallback baked in here. Per
 * docs/ARCHITECTURE.md, a campaign's authoritative module is whichever instance it PINNED at
 * settlement-mode adoption, which can differ from the current global default
 * (`config.addresses.onChainRewardModule`) if the default has since rotated. Every call site
 * below resolves the address explicitly (via getPinnedRewardModule for an existing campaign,
 * or the global default ONLY for a brand-new campaign's first setRankTiers/setScoreTiers call,
 * before any pin exists) — never hardcode or assume one over the other.
 */
export const getOnChainRewardModuleContract = (
  moduleAddress: string,
  runner: ethers.ContractRunner,
): Contract => new ethers.Contract(moduleAddress, OnChainRewardModule.abi, runner) as Contract

/**
 * Read the campaign's PINNED reward-module address directly from the entrypoint
 * (getCampaignRewardModule) — undefined if the campaign never adopted a tiered mode (no pin).
 * This is the ONLY correct way to find which module instance is authoritative for an existing
 * campaign; never assume it's the current global default (docs/ARCHITECTURE.md pinning rules).
 */
export const getPinnedRewardModule = async (campaignId: string): Promise<string | undefined> => {
  const c = getEntrypointReadContract()
  const addr: string = await c.getCampaignRewardModule(campaignId)
  return addr && addr !== ethers.ZeroAddress ? addr : undefined
}

export type TieredRewardStatus = {
  mode: 'UNSET' | 'MERKLE' | 'RANK_TIERED' | 'SCORE_TIERED'
  rank: number
  score: number
  qualified: boolean
  claimed: boolean
}

const ONCHAIN_SETTLEMENT_MODE_LABELS: TieredRewardStatus['mode'][] = [
  'UNSET',
  'MERKLE',
  'RANK_TIERED',
  'SCORE_TIERED',
]

/**
 * A single participant's rank/score/qualification/claimed status, read from the campaign's
 * PINNED module (never the global default). Returns undefined if the campaign never pinned a
 * reward module (not a tiered campaign).
 */
export const getTieredRewardStatus = async (
  campaignId: string,
  participant: string,
): Promise<TieredRewardStatus | undefined> => {
  const moduleAddress = await getPinnedRewardModule(campaignId)
  if (!moduleAddress) return undefined
  const c = getOnChainRewardModuleContract(moduleAddress, getReadOnlyContract()!.runner!)
  const [mode, rank, score, qualified, claimed] = await c.getOnChainRewardStatus(
    campaignId,
    participant,
  )
  return {
    mode: ONCHAIN_SETTLEMENT_MODE_LABELS[Number(mode)] ?? 'UNSET',
    rank: Number(rank),
    score: Number(score),
    qualified,
    claimed,
  }
}

export type TierView = { threshold: string; thresholdEnd: string; amount: string }

/** Configured tiers for a campaign, read from its PINNED module. Empty if never pinned. */
export const getTieredTiers = async (campaignId: string): Promise<TierView[]> => {
  const moduleAddress = await getPinnedRewardModule(campaignId)
  if (!moduleAddress) return []
  const c = getOnChainRewardModuleContract(moduleAddress, getReadOnlyContract()!.runner!)
  const tiers = await c.getTiers(campaignId)
  return tiers.map((t: any) => ({
    threshold: t.threshold.toString(),
    thresholdEnd: t.thresholdEnd.toString(),
    amount: t.amount.toString(),
  }))
}

export type LeaderboardEntry = {
  address: string
  rank: number
  score: number
  qualified: boolean
  claimed: boolean
}

/**
 * Leaderboard standings for a tiered campaign. There is no bulk on-chain getter for
 * rank/score (OnChainRewardModule only exposes getOnChainRewardStatus per-participant), so
 * this reads the participant list (already indexed/cached elsewhere in this file) and fans out
 * with the SAME bounded concurrency (PARTICIPANT_QUERY_CONCURRENCY) used by
 * getCampaignParticipants, against the campaign's PINNED module. Sorted by rank (RANK_TIERED,
 * unranked last) or score descending (SCORE_TIERED).
 */
export const getTieredLeaderboard = async (campaign: Campaign): Promise<LeaderboardEntry[]> => {
  const moduleAddress = await getPinnedRewardModule(campaign.id)
  if (!moduleAddress) return []

  const participants = await getCampaignParticipants(campaign)
  if (participants.length === 0) return []

  const c = getOnChainRewardModuleContract(moduleAddress, getReadOnlyContract()!.runner!)
  const isRank = campaign.settlement?.mode === 'RANK_TIERED'

  const entries = await runWithConcurrency(
    participants.map((p) => p.address),
    PARTICIPANT_QUERY_CONCURRENCY,
    async (address): Promise<LeaderboardEntry> => {
      const [, rank, score, qualified, claimed] = await c.getOnChainRewardStatus(
        campaign.id,
        address,
      )
      return {
        address,
        rank: Number(rank),
        score: Number(score),
        qualified,
        claimed,
      }
    },
  )

  return entries
    .filter((e) => (isRank ? e.rank > 0 : e.score > 0))
    .sort((a, b) => (isRank ? a.rank - b.rank : b.score - a.score))
}

export type ClaimEvent = { account: string; blockNumber: number; timestamp: number }

/**
 * Claim events for a campaign, read directly from chain logs (BR-I4 — the subgraph is
 * currently disabled per docs/DECISIONS_v0.6.0.md Decision 3, so this is the direct-RPC
 * equivalent of "indexed data" for claim-rate-over-time analytics). Selects the event/contract
 * matching the campaign's settlement mode: ERC20RewardClaimed (Merkle, on the entrypoint —
 * covers both self- and sponsored claims, since claimERC20For shares the same emit path),
 * ERC20RewardClaimedOnChain (tiered, entrypoint), or NFTRewardClaimed (NFT, on the campaign's
 * PINNED module). `campaignId` is an indexed topic on all three, so the RPC filters server-side
 * rather than scanning every campaign's events.
 *
 * Chunked with a single range-limit fallback (not the full adaptive retry loop
 * getCampaignParticipantAddresses uses) — claim events are orders of magnitude rarer than
 * per-participant task-completion events, so a simpler scan is an acceptable, documented
 * tradeoff for a display-only analytics feature.
 */
export const getClaimEvents = async (campaign: Campaign): Promise<ClaimEvent[]> => {
  const mode = campaign.settlement?.mode
  let contractToUse: Contract | null = null
  let filter: ReturnType<Contract['filters']['ERC20RewardClaimed']> | null = null

  if (mode === 'RANK_TIERED' || mode === 'SCORE_TIERED') {
    contractToUse = getEntrypointReadContract()
    filter = contractToUse.filters.ERC20RewardClaimedOnChain(campaign.id)
  } else if (mode === 'NFT') {
    const moduleAddress = await getPinnedNFTModule(campaign.id)
    if (!moduleAddress) return []
    contractToUse = getNFTSettlementModuleContract(moduleAddress, getReadOnlyContract()!.runner!)
    filter = contractToUse.filters.NFTRewardClaimed(campaign.id)
  } else if (mode === 'MERKLE_ERC20') {
    contractToUse = getEntrypointReadContract()
    filter = contractToUse.filters.ERC20RewardClaimed(campaign.id)
  } else {
    return []
  }

  const provider = contractToUse.runner as ethers.Provider
  const latestBlock = await provider.getBlockNumber()
  // Scanning from the CONTRACT's deploy block (weeks/months of history for a long-lived
  // deployment) rather than this CAMPAIGN's own window is wasteful and, on a rate/range-limited
  // provider, can make the scan take many minutes for no reason. Estimate a start block from
  // the campaign's own startDate via the deploy block's real timestamp (one cheap extra read)
  // interpolated against the current block/time, with a safety margin for estimation error —
  // a campaign's claim events can only exist after it started, so this can never miss real
  // events, only avoid scanning blocks that could never contain any.
  const deployBlock = config.addresses.deployBlock || 0
  let fromBlockBase = deployBlock
  try {
    const [deployBlockInfo, latestBlockInfo] = await Promise.all([
      provider.getBlock(deployBlock),
      provider.getBlock(latestBlock),
    ])
    if (deployBlockInfo && latestBlockInfo && latestBlockInfo.timestamp > deployBlockInfo.timestamp) {
      const avgSecondsPerBlock =
        (latestBlockInfo.timestamp - deployBlockInfo.timestamp) / (latestBlock - deployBlock)
      const campaignStartUnix = Math.floor(campaign.startDate.getTime() / 1000)
      const SAFETY_MARGIN_SECONDS = 6 * 3600 // 6h — generous cushion against estimation drift
      const estimatedBlocksSinceDeploy = Math.floor(
        (campaignStartUnix - SAFETY_MARGIN_SECONDS - deployBlockInfo.timestamp) / avgSecondsPerBlock,
      )
      fromBlockBase = Math.max(deployBlock, deployBlock + estimatedBlocksSinceDeploy)
    }
  } catch (e) {
    console.warn('getClaimEvents: block-time estimation failed, falling back to deployBlock:', e)
  }

  // Probe the provider's actual max eth_getLogs range with a single call before building the
  // chunk plan — found live against this deployment's RPC (Alchemy free tier): it hard-caps at
  // 10 blocks/request, nowhere near MAX_LOG_RANGE_FALLBACK (2000). Discovering this AFTER
  // starting a sequential scan (the original approach) meant shrinking chunk size mid-scan and
  // continuing sequentially — over a ~13k block window at 10 blocks/chunk that's ~1300
  // sequential round-trips, effectively hanging. Discovering it up front lets the whole chunk
  // plan be fetched CONCURRENTLY instead (bounded), which is what actually fixes the wall-clock
  // time — smaller chunks alone would not have.
  let chunkSize = MAX_LOG_RANGE_FALLBACK
  try {
    await contractToUse.queryFilter(filter, fromBlockBase, Math.min(fromBlockBase + chunkSize, latestBlock))
  } catch (error: any) {
    const msg: string = error?.error?.message || error?.shortMessage || error?.message || ''
    const rangeMatch = msg.match(/up to a (\d+) block range/i)
    if (rangeMatch?.[1]) {
      chunkSize = Math.max(1, Number(rangeMatch[1]))
    }
  }

  let ranges: { from: number; to: number }[] = []
  for (let from = fromBlockBase; from <= latestBlock; from += chunkSize) {
    ranges.push({ from, to: Math.min(from + chunkSize - 1, latestBlock) })
  }

  // Hard cap on total requests: on a heavily rate/range-limited free-tier RPC (10
  // blocks/request observed live against this deployment's endpoint), a wide window can still
  // mean hundreds of chunks even after scoping to the campaign's own dates. This is a
  // display-only analytics feature (BR-I4: never a value-bearing read), so a bounded-time
  // partial result is the right tradeoff over blocking the host's page load for minutes — if
  // the cap is hit, the OLDEST part of the window is dropped first (claims right after Ended
  // are the common case and most useful to show; a campaign's full historical curve is a
  // nice-to-have, not required for the funnel counts elsewhere in this module, which come from
  // getCampaignParticipants/DB, not from this scan).
  const MAX_CHUNKS = 200
  if (ranges.length > MAX_CHUNKS) {
    console.warn(
      `getClaimEvents: ${ranges.length} chunks needed for campaign ${campaign.id}, capping to the most recent ${MAX_CHUNKS} (partial result — claims-over-time chart may be missing older entries)`,
    )
    ranges = ranges.slice(-MAX_CHUNKS)
  }

  const CONCURRENCY = 4 // matches PARTICIPANT_QUERY_CONCURRENCY's convention — a higher value
  // was tried live and made rate-limiting worse, not better, against this free-tier RPC.
  const MAX_RATE_LIMIT_RETRIES = 3
  const chunkResults = await runWithConcurrency(ranges, CONCURRENCY, async ({ from, to }) => {
    let retries = 0
    for (;;) {
      try {
        return await contractToUse!.queryFilter(filter!, from, to)
      } catch (error: any) {
        const msg: string = error?.error?.message || error?.shortMessage || error?.message || ''
        const isRateLimit = /compute units per second|rate limit|429/i.test(msg)
        if (isRateLimit && retries < MAX_RATE_LIMIT_RETRIES) {
          retries++
          await new Promise((resolve) => setTimeout(resolve, 400 * retries))
          continue
        }
        console.warn(`getClaimEvents: chunk [${from},${to}] failed, skipping:`, msg)
        return []
      }
    }
  })
  const events: ethers.Log[] = chunkResults.flat() as unknown as ethers.Log[]

  // Resolve block timestamps with bounded concurrency — one RPC call per unique block.
  const uniqueBlocks = Array.from(new Set(events.map((e) => e.blockNumber)))
  const blockTimestamps = new Map<number, number>()
  await runWithConcurrency(uniqueBlocks, PARTICIPANT_QUERY_CONCURRENCY, async (bn) => {
    const block = await provider.getBlock(bn)
    if (block) blockTimestamps.set(bn, block.timestamp)
  })

  return events.map((e) => {
    const parsed = contractToUse!.interface.parseLog(e)
    return {
      account: (parsed?.args?.account as string) ?? '',
      blockNumber: e.blockNumber,
      timestamp: blockTimestamps.get(e.blockNumber) ?? 0,
    }
  })
}

/**
 * Draft-only: commit a campaign to RANK_TIERED and configure its tiers, via the CURRENT GLOBAL
 * DEFAULT module (config.addresses.onChainRewardModule) — the one legitimate call site that
 * uses the default directly, because this is exactly the call that CREATES the pin (per
 * docs/ARCHITECTURE.md: "the first RANK_TIERED/SCORE_TIERED commit records
 * _campaignRewardModule[id] = _onChainRewardModule"). Never use this address for anything else.
 */
export const configureRankTiers = async (
  campaignId: string,
  tiers: { startRank: number; endRank: number; amount: string }[],
  tokenDecimals: number,
): Promise<void> => {
  const signer = await getSigner()
  const c = getOnChainRewardModuleContract(config.addresses.onChainRewardModule, signer)
  try {
    const tx = await c.setRankTiers(
      campaignId,
      tiers.map((t) => t.startRank),
      tiers.map((t) => t.endRank),
      tiers.map((t) => ethers.parseUnits(t.amount, tokenDecimals)),
    )
    await tx.wait()
  } catch (error: any) {
    console.error('Error configuring rank tiers:', error)
    toast({
      variant: 'destructive',
      title: 'Failed to configure rank tiers',
      description: mapContractRevertToMessage(error),
    })
    throw error
  }
}

/** Draft-only: commit a campaign to SCORE_TIERED and configure its tiers. Same global-default
 * pinning call site as configureRankTiers — see its docstring. */
export const configureScoreTiers = async (
  campaignId: string,
  tiers: { minScore: number; amount: string }[],
  tokenDecimals: number,
): Promise<void> => {
  const signer = await getSigner()
  const c = getOnChainRewardModuleContract(config.addresses.onChainRewardModule, signer)
  try {
    const tx = await c.setScoreTiers(
      campaignId,
      tiers.map((t) => t.minScore),
      tiers.map((t) => ethers.parseUnits(t.amount, tokenDecimals)),
    )
    await tx.wait()
  } catch (error: any) {
    console.error('Error configuring score tiers:', error)
    toast({
      variant: 'destructive',
      title: 'Failed to configure score tiers',
      description: mapContractRevertToMessage(error),
    })
    throw error
  }
}

/** Draft-only: assign point values to specific tasks for SCORE_TIERED scoring. Same
 * global-default call site (must run before/alongside setScoreTiers — either order is fine,
 * per REWARD_SYSTEM.md, since points and tier-mode adoption are independent state). */
export const configureTaskPoints = async (
  campaignId: string,
  points: { taskIndex: number; points: number }[],
): Promise<void> => {
  const signer = await getSigner()
  const c = getOnChainRewardModuleContract(config.addresses.onChainRewardModule, signer)
  try {
    const tx = await c.setTaskPoints(
      campaignId,
      points.map((p) => p.taskIndex),
      points.map((p) => p.points),
    )
    await tx.wait()
  } catch (error: any) {
    console.error('Error configuring task points:', error)
    toast({
      variant: 'destructive',
      title: 'Failed to configure task points',
      description: mapContractRevertToMessage(error),
    })
    throw error
  }
}

/** Self-claim: OnChainRewardModule.claimReward on the campaign's PINNED module. */
export const claimTieredReward = async (campaignId: string): Promise<string> => {
  const moduleAddress = await getPinnedRewardModule(campaignId)
  if (!moduleAddress) throw new Error('This campaign has no tiered reward module pinned.')
  const signer = await getSigner()
  const c = getOnChainRewardModuleContract(moduleAddress, signer)
  try {
    const tx = await c.claimReward(campaignId)
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error('Error claiming tiered reward:', error)
    throw error
  }
}

// ---------------------------------------------------------------------------
// P3 CP2 — NFT Merkle settlement (NFTSettlementModule, ERC721 + ERC1155)
// ---------------------------------------------------------------------------

export const NFTStandardValue = { ERC721: 0, ERC1155: 1 } as const
export type NFTStandardLabel = keyof typeof NFTStandardValue

/**
 * Construct an NFTSettlementModule Contract at an EXPLICIT address — same discipline as
 * getOnChainRewardModuleContract: never a baked-in default, every caller resolves the
 * campaign's actual pin first (getPinnedNFTModule) except the one legitimate exception (a
 * brand-new campaign's first deposit, which is what CREATES the pin).
 */
export const getNFTSettlementModuleContract = (
  moduleAddress: string,
  runner: ethers.ContractRunner,
): Contract => new ethers.Contract(moduleAddress, NFTSettlementModule.abi, runner) as Contract

/**
 * Read the campaign's PINNED NFT module address (getCampaignNFTModule on the entrypoint) —
 * undefined if the campaign never received an NFT deposit (no pin yet). Unlike the reward
 * module (pinned at settlement-mode adoption), the NFT module pins at FIRST DEPOSIT
 * (docs/ARCHITECTURE.md) — so this can be undefined even for a campaign that will end up NFT,
 * right up until its first depositERC721Rewards/depositERC1155Rewards call.
 */
export const getPinnedNFTModule = async (campaignId: string): Promise<string | undefined> => {
  const c = getEntrypointReadContract()
  const addr: string = await c.getCampaignNFTModule(campaignId)
  return addr && addr !== ethers.ZeroAddress ? addr : undefined
}

/**
 * Draft/Open/Ended: escrow ERC721 tokenIds for a campaign, max 100/call (contract-enforced) —
 * callers with more than 100 must batch across multiple calls (the wizard does this). Approval
 * (setApprovalForAll) must already be granted to the entrypoint; checked/requested here.
 */
export const depositERC721Rewards = async (
  campaignId: string,
  tokenAddress: string,
  tokenIds: string[],
): Promise<string> => {
  if (tokenIds.length === 0 || tokenIds.length > 100) {
    throw new Error('depositERC721Rewards: batch must be 1-100 tokenIds.')
  }
  const signer = await getSigner()
  const signerAddress = await signer.getAddress()
  const nft = new ethers.Contract(
    tokenAddress,
    ['function isApprovedForAll(address,address) view returns (bool)', 'function setApprovalForAll(address,bool)'],
    signer,
  )
  const approved: boolean = await nft.isApprovedForAll(signerAddress, config.addresses.entrypoint)
  if (!approved) {
    const approveTx = await nft.setApprovalForAll(config.addresses.entrypoint, true)
    await approveTx.wait()
  }
  if (!contract) throw new Error('Contract not initialized')
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const tx = await contractWithSigner.depositERC721Rewards(campaignId, tokenAddress, tokenIds)
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error('Error depositing ERC721 rewards:', error)
    toast({
      variant: 'destructive',
      title: 'Failed to deposit NFTs',
      description: mapContractRevertToMessage(error),
    })
    throw error
  }
}

/** Same as depositERC721Rewards but for ERC1155 (ids + per-id amounts, max 100/call). */
export const depositERC1155Rewards = async (
  campaignId: string,
  tokenAddress: string,
  ids: string[],
  amounts: string[],
): Promise<string> => {
  if (ids.length === 0 || ids.length > 100 || ids.length !== amounts.length) {
    throw new Error('depositERC1155Rewards: 1-100 ids, matching amounts array.')
  }
  const signer = await getSigner()
  const signerAddress = await signer.getAddress()
  const nft = new ethers.Contract(
    tokenAddress,
    ['function isApprovedForAll(address,address) view returns (bool)', 'function setApprovalForAll(address,bool)'],
    signer,
  )
  const approved: boolean = await nft.isApprovedForAll(signerAddress, config.addresses.entrypoint)
  if (!approved) {
    const approveTx = await nft.setApprovalForAll(config.addresses.entrypoint, true)
    await approveTx.wait()
  }
  if (!contract) throw new Error('Contract not initialized')
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const tx = await contractWithSigner.depositERC1155Rewards(campaignId, tokenAddress, ids, amounts)
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error('Error depositing ERC1155 rewards:', error)
    toast({
      variant: 'destructive',
      title: 'Failed to deposit NFTs',
      description: mapContractRevertToMessage(error),
    })
    throw error
  }
}

/** Host-signed setNFTMerkleRoot on the campaign's PINNED module (mirrors submitERC20MerkleRoot). */
export const submitNFTMerkleRoot = async (campaignId: string, root: string): Promise<string> => {
  const moduleAddress = await getPinnedNFTModule(campaignId)
  if (!moduleAddress) throw new Error('This campaign has no NFT module pinned (no deposit made yet).')
  const signer = await getSigner()
  const c = getNFTSettlementModuleContract(moduleAddress, signer)
  try {
    const tx = await c.setNFTMerkleRoot(campaignId, root)
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error('Error publishing NFT Merkle root:', error)
    throw error
  }
}

/** Self-claim: NFTSettlementModule.claimNFT on the campaign's PINNED module. */
export const claimNFTReward = async (
  campaignId: string,
  standard: NFTStandardLabel,
  tokenAddress: string,
  tokenId: string,
  amount: string,
  proof: string[],
): Promise<string> => {
  const moduleAddress = await getPinnedNFTModule(campaignId)
  if (!moduleAddress) throw new Error('This campaign has no NFT module pinned.')
  const signer = await getSigner()
  const c = getNFTSettlementModuleContract(moduleAddress, signer)
  try {
    const tx = await c.claimNFT(campaignId, NFTStandardValue[standard], tokenAddress, tokenId, amount, proof)
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error('Error claiming NFT reward:', error)
    throw error
  }
}

/**
 * O(1) on-chain check for a single participant/task. Used where a caller must distinguish
 * "already completed on-chain" from "verified in our DB cache but never actually recorded
 * on-chain" (e.g. a verifier route deciding whether to skip re-attesting a cached PASS).
 */
export const hasCompletedTaskOnChain = async (
  campaignId: number,
  participant: string,
  taskIndex: number,
): Promise<boolean> => {
  try {
    const c = getEntrypointReadContract()
    return await c.hasCompletedTask(campaignId, participant, taskIndex)
  } catch (e) {
    console.warn('hasCompletedTaskOnChain failed:', e)
    return false
  }
}

const ZERO_ROOT = '0x' + '00'.repeat(32)

/**
 * Read a campaign's on-chain settlement/lifecycle facts directly (O(1) RPC). Powers the
 * lifecycle-state ladder (NFR-9) on the single-campaign detail path, which does not go
 * through the subgraph. Best-effort: returns undefined if reads fail.
 *
 * BR-I4: this IS a direct-RPC read, so it is authoritative enough to display; the eventual
 * claim action (P1) still re-simulates against chain state at execution time.
 */
export const getCampaignSettlement = async (
  id: string,
): Promise<CampaignSettlement | undefined> => {
  let c = contract ?? readOnlyContract
  if (!c) {
    initializeReadOnlyProvider()
    c = readOnlyContract
  }
  if (!c) return undefined

  try {
    const [erc20, maxP, nftModule, rewardModule] = await Promise.all([
      c.getERC20Settlement(id), // [token, escrowed, distributed, merkleRoot, closedAt, swept]
      c.getMaxParticipants(id),
      c.getCampaignNFTModule(id),
      c.getCampaignRewardModule(id),
    ])

    const token: string = erc20.token ?? erc20[0]
    const escrowed = (erc20.escrowed ?? erc20[1]).toString()
    const merkleRoot: string = erc20.merkleRoot ?? erc20[3]
    const closedAtRaw = Number(erc20.closedAt ?? erc20[4])
    const swept: boolean = erc20.swept ?? erc20[5]

    const hasErc20Root = Boolean(merkleRoot && merkleRoot !== ZERO_ROOT)
    let erc20RootPublishedAt: Date | undefined
    if (hasErc20Root) {
      const claimableAt = Number(await c.getERC20ClaimableAt(id))
      if (claimableAt > 0) {
        erc20RootPublishedAt = new Date((claimableAt - 24 * 3600) * 1000)
      }
    }

    const nftPinned = Boolean(nftModule && nftModule !== ethers.ZeroAddress)
    const rewardPinned = Boolean(rewardModule && rewardModule !== ethers.ZeroAddress)

    // The NFT list lives on the campaign's PINNED NFT module. Without it this path reported every
    // NFT campaign as "no list yet", and the host-close guard (settlementOwedOnClose) couldn't
    // tell whether closeCampaign would revert SettlementNotPublished. undefined = couldn't read.
    let nftMerkleRoot: string | null | undefined
    let nftRootPublishedAt: Date | undefined
    if (nftPinned) {
      try {
        const nftContract = getNFTSettlementModuleContract(nftModule, c.runner!)
        const [nftRoot, nftClaimableAt] = await Promise.all([
          nftContract.getNFTMerkleRoot(id),
          nftContract.getNFTClaimableAt(id),
        ])
        nftMerkleRoot = nftRoot && nftRoot !== ZERO_ROOT ? nftRoot : null
        if (nftMerkleRoot && Number(nftClaimableAt) > 0) {
          nftRootPublishedAt = new Date((Number(nftClaimableAt) - 24 * 3600) * 1000)
        }
      } catch (e) {
        console.warn(`getCampaignSettlement: NFT root read failed for ${id}:`, e)
      }
    }

    // Mode derivation. RANK_TIERED vs SCORE_TIERED is only distinguishable via a module read
    // (CP1 fix — was a TODO): when a reward module is pinned, read the campaign's own
    // committed mode straight off it (getOnChainRewardStatus's `mode` field is campaign-level,
    // not participant-specific, so ZeroAddress is a valid probe address) rather than guessing.
    let mode: SettlementMode = 'UNSET'
    let tierCount: number | undefined
    if (hasErc20Root) {
      mode = 'MERKLE_ERC20'
    } else if (nftPinned) {
      mode = 'NFT'
    } else if (rewardPinned) {
      try {
        const rewardModuleContract = getOnChainRewardModuleContract(rewardModule, c.runner!)
        const [[onChainMode], tiers] = await Promise.all([
          rewardModuleContract.getOnChainRewardStatus(id, ethers.ZeroAddress),
          rewardModuleContract.getTiers(id),
        ])
        mode = ONCHAIN_SETTLEMENT_MODE_LABELS[Number(onChainMode)] === 'SCORE_TIERED'
          ? 'SCORE_TIERED'
          : 'RANK_TIERED'
        tierCount = tiers.length
      } catch (e) {
        console.warn(`getCampaignSettlement: reward-module mode read failed for ${id}, defaulting to RANK_TIERED:`, e)
        mode = 'RANK_TIERED'
      }
    }

    return {
      mode,
      maxParticipants: Number(maxP),
      closedAt: closedAtRaw > 0 ? new Date(closedAtRaw * 1000) : undefined,
      erc20Token: token && token !== ethers.ZeroAddress ? token : undefined,
      erc20EscrowedNet: escrowed,
      erc20MerkleRoot: hasErc20Root ? merkleRoot : null,
      erc20RootPublishedAt,
      erc20Swept: swept,
      nftModule: nftPinned ? nftModule : undefined,
      nftMerkleRoot,
      nftRootPublishedAt,
      rewardModule: rewardPinned ? rewardModule : undefined,
      tierCount,
    }
  } catch (e) {
    console.warn(`getCampaignSettlement failed for ${id}:`, e)
    return undefined
  }
}

// Enhanced function to get campaign by ID with Discord invite links for client-side use
export const getCampaignByIdWithMetadata = async (
  id: string,
  forceRefresh: boolean = false,
): Promise<Campaign | null> => {
  console.log(
    `getCampaignByIdWithMetadata called for campaign ${id}, forceRefresh: ${forceRefresh}`,
  )

  // First get the basic campaign data
  const campaign = await getCampaignById(id)
  if (!campaign) return null

  // Attach on-chain settlement/lifecycle facts for the NFR-9 state ladder (best-effort).
  campaign.settlement = await getCampaignSettlement(id)

  console.log(`Base campaign data fetched for ${id}:`, {
    status: campaign.status,
    title: campaign.title,
    participants: campaign.participants,
  })

  // Then enhance it with task metadata (only on client-side)
  if (typeof window !== 'undefined') {
    try {
      const taskMetadata = await fetchTaskMetadata(id)
      if (taskMetadata && Array.isArray(taskMetadata)) {
        // Enrich tasks with all stored metadata
        campaign.tasks = campaign.tasks.map((task, index) => {
          const meta = taskMetadata.find((tm) => tm.taskIndex === index)
          if (!meta) return task

          if (task.type === 'JOIN_DISCORD' && meta.discordInviteLink) {
            return { ...task, discordInviteLink: meta.discordInviteLink }
          }

          if (task.type === 'JOIN_TELEGRAM' && meta.telegramInviteLink) {
            return { ...task, telegramInviteLink: meta.telegramInviteLink }
          }

          if (
            task.type === 'HUMANITY_VERIFICATION' &&
            meta.metadata?.humanityPreset
          ) {
            return {
              ...task,
              metadata: {
                ...task.metadata,
                humanityPreset: meta.metadata.humanityPreset,
              },
            }
          }

          if (task.type === 'ONCHAIN_TX' && meta.metadata) {
            return {
              ...task,
              metadata: { ...task.metadata, ...meta.metadata },
            }
          }

          return task
        })
      }
    } catch (e) {
      console.warn('Failed to enhance campaign with task metadata:', e)
    }
  }

  // Note: imageUrl is already fetched in getCampaignById, no need to fetch again

  console.log(`Final enhanced campaign data for ${id}:`, {
    status: campaign.status,
    tasksCount: campaign.tasks.length,
    hasDiscordTasks: campaign.tasks.some((t) => t.type === 'JOIN_DISCORD'),
  })

  return campaign
}

export const hasParticipated = async (
  campaignId: string,
  participantAddress: string,
): Promise<boolean> => {
  if (!participantAddress) return false

  const cacheKey = `${config.chainId}:${config.campaignFactoryAddress ?? 'unknown'}:${campaignId}:${participantAddress.toLowerCase()}`
  const cached = participationCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.updatedAt < PARTICIPATION_CACHE_TTL_MS) {
    return cached.value
  }

  if (cached?.inFlight) {
    return cached.inFlight
  }

  const fetchPromise = (async () => {
    let contractToUse = getReadOnlyContract() ?? contract
    if (!contractToUse) return cached?.value ?? false

    try {
      // Convert campaignId from string to number for smart contract calls
      const campaignIdNumber = parseInt(campaignId, 10)
      const value = await contractToUse.hasParticipated(
        campaignIdNumber,
        participantAddress,
      )
      return Boolean(value)
    } catch (error: any) {
      if (error?.code === 'BAD_DATA' || error?.code === 'CALL_EXCEPTION') {
        console.warn(
          `Campaign ${campaignId} or participation data not found/reverted.`,
        )
      } else {
        console.warn(
          `Error checking participation for ${participantAddress} in campaign ${campaignId}:`,
          error?.message || 'Unknown error',
        )
      }
      // Don't show a toast for this, as it might be called frequently
      return cached?.value ?? false
    }
  })()

  participationCache.set(cacheKey, {
    value: cached?.value ?? false,
    updatedAt: cached?.updatedAt ?? 0,
    inFlight: fetchPromise,
  })

  try {
    const value = await fetchPromise
    participationCache.set(cacheKey, {
      value,
      updatedAt: Date.now(),
    })
    return value
  } finally {
    const latest = participationCache.get(cacheKey)
    if (latest?.inFlight === fetchPromise) {
      participationCache.set(cacheKey, {
        value: latest.value,
        updatedAt: latest.updatedAt,
      })
    }
  }
}

export const isHost = async (address: string): Promise<boolean> => {
  if (!address) return false

  const cacheKey = `${config.chainId}:${config.campaignFactoryAddress ?? 'unknown'}:${address.toLowerCase()}`
  const cached = hostRoleCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.updatedAt < HOST_ROLE_CACHE_TTL_MS) {
    return cached.value
  }

  if (cached?.inFlight) {
    return cached.inFlight
  }

  const fetchPromise = (async () => {
    let contractToUse = getReadOnlyContract() ?? contract
    if (!contractToUse) return cached?.value ?? false
    try {
      const hostRole = await contractToUse.HOST_ROLE()
      const value = await contractToUse.hasRole(hostRole, address)
      return Boolean(value)
    } catch (error) {
      console.error('Error checking for host role:', error)
      return cached?.value ?? false
    }
  })()

  hostRoleCache.set(cacheKey, {
    value: cached?.value ?? false,
    updatedAt: cached?.updatedAt ?? 0,
    inFlight: fetchPromise,
  })

  try {
    const value = await fetchPromise
    hostRoleCache.set(cacheKey, { value, updatedAt: Date.now() })
    return value
  } finally {
    const latest = hostRoleCache.get(cacheKey)
    if (latest?.inFlight === fetchPromise) {
      hostRoleCache.set(cacheKey, {
        value: latest.value,
        updatedAt: latest.updatedAt,
      })
    }
  }
}

export const becomeHost = async () => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const tx = await contractWithSigner.grantHostRole(signer.address)
    await tx.wait()
    toast({
      title: 'You can host campaigns now',
      description: 'Your wallet has the host role. Create your first campaign.',
    })
  } catch (error: any) {
    console.error('Error granting host role:', error)
    toast({
      variant: 'destructive',
      title: 'Could not become a host',
      description: mapContractRevertToMessage(error),
    })
    throw error
  }
}

export const openCampaign = async (
  campaignId: string,
  toast: any,
): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract

  try {
    // Convert campaignId from string to number for smart contract calls
    const campaignIdNumber = parseInt(campaignId, 10)
    console.log(`Opening campaign ${campaignIdNumber}...`)

    // Get the current campaign data to check its status and times
    const campaignData = await contractWithSigner.getCampaign(campaignIdNumber)

    // Check if the campaign is already open (status 1 = Open)
    if (Number(campaignData.status) === 1) {
      console.log(`Campaign ${campaignId} is already open.`)
      toast({
        title: 'Already Open',
        description: `Campaign ${campaignId} is already open.`,
      })
      return campaignId
    }

    // Check if the campaign is in draft status (status 0 = Draft)
    if (Number(campaignData.status) !== 0) {
      toast({
        title: 'Cannot Open Campaign',
        description: 'Campaign must be in Draft status to be opened.',
        variant: 'destructive',
      })
      throw new Error('Campaign is not in Draft status')
    }

    try {
      // Try to open the campaign
      const tx = await contractWithSigner.openCampaign(campaignIdNumber)
      await tx.wait()

      toast({
        title: 'Campaign is now Open!',
        description: `Campaign ${campaignId} has been successfully opened.`,
      })

      return campaignId
    } catch (openError: any) {
      console.error(`Failed to open campaign ${campaignId}:`, openError)

      // The shared mapper reads the reverting function, so CampaignAlreadyStarted from
      // openCampaign reads "This campaign has already been opened."
      const errorMessage = mapContractRevertToMessage(openError)

      toast({
        title: 'Failed to Open Campaign',
        description: errorMessage,
        variant: 'destructive',
      })

      throw new Error(`Cannot open campaign: ${errorMessage}`)
    }
  } catch (error: any) {
    console.error(`Error opening campaign ${campaignId}:`, error)

    // If it's already our custom error, re-throw it
    if (error.message && error.message.includes('Cannot open campaign:')) {
      throw error
    }

    toast({
      variant: 'destructive',
      title: 'Transaction Failed',
      description: `Failed to open campaign. ${
        error.message || 'An unknown error occurred.'
      }`,
    })
    throw error
  }
}

export const endCampaign = async (campaignId: string) => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    // Convert campaignId from string to number for smart contract calls
    const campaignIdNumber = parseInt(campaignId, 10)
    const tx = await contractWithSigner.endCampaign(campaignIdNumber)
    await tx.wait()
    toast({
      title: 'Campaign Ended',
      description: `Campaign ${campaignId} has been successfully ended.`,
    })
  } catch (error: any) {
    console.error(`Error ending campaign ${campaignId}:`, error)
    toast({
      variant: 'destructive',
      title: 'The end wasn’t recorded',
      description: mapContractRevertToMessage(error),
    })
    throw error
  }
}

/** P4 — closes a campaign (Ended -> Closed), freezing the allocation permanently. There was
 * no frontend caller of this ABI function before P4; the UI trigger lives in the settlement
 * panels alongside the dispute-report resolution flow, since that's where a host needs to see
 * the "unresolved reports" warning before calling this. */
export const closeCampaignOnChain = async (campaignId: string): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const campaignIdNumber = parseInt(campaignId, 10)
    const tx = await contractWithSigner.closeCampaign(campaignIdNumber)
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error(`Error closing campaign ${campaignId}:`, error)
    throw error
  }
}

/**
 * What a host's options are before closing (Ended -> Closed). Every answer comes from the chain,
 * not the indexer: the participant count decides whether we tell the host "no one
 * participated", and closing vs cancelling routes escrow — subgraph lag must not drive either.
 *
 * `canCancel` is a staticCall of cancelCampaign from the host's own signer rather than a
 * client-side re-derivation of its rules (Draft/Open/Ended, zero participants, ERC20 mode UNSET,
 * no NFT root, onlyHost, not paused). There's no on-chain getter for the ERC20 settlement mode,
 * and a staticCall can't drift from the contract. Any failure — a real revert or a flaky RPC —
 * reads as "can't cancel", which only hides the option; it never offers one that would revert.
 * Tiered campaigns always come back false here: configuring tiers locks their mode in Draft.
 *
 * `settlementOwed`: closeCampaign would revert SettlementNotPublished (contracts PR #26) because
 * escrowed tokens or deposited NFTs still have no published list. Read from the same getters the
 * contract's guard uses (settlementOwedOnClose); null = couldn't read, and the dialog then lets
 * the contract decide (its revert is mapped to "Can't close yet. Publish the reward list first.").
 */
export const getCloseOptions = async (
  campaignId: string,
): Promise<{ totalParticipants: number; canCancel: boolean; settlementOwed: boolean | null }> => {
  const c = getReadOnlyContract()
  if (!c) throw new Error('Contract not initialized')
  const id = parseInt(campaignId, 10)
  const [data, settlement] = await Promise.all([c.getCampaign(id), getCampaignSettlement(campaignId)])
  const totalParticipants = Number(data.totalParticipants)
  const settlementOwed = settlementOwedOnClose(settlement)
  if (totalParticipants !== 0 || !contract) return { totalParticipants, canCancel: false, settlementOwed }
  try {
    const signer = await getSigner()
    await (contract.connect(signer) as Contract).cancelCampaign.staticCall(id)
    return { totalParticipants, canCancel: true, settlementOwed }
  } catch {
    return { totalParticipants, canCancel: false, settlementOwed }
  }
}

/** Host-only cancelCampaign. ERC20 escrow is refunded to the host in this same tx; escrowed
 * NFTs are NOT transferred — they become withdrawable immediately (no 30-day grace). Errors
 * propagate for the caller to map (mapContractRevertToMessage). */
export const cancelCampaignOnChain = async (campaignId: string): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const tx = await (contract.connect(signer) as Contract).cancelCampaign(parseInt(campaignId, 10))
  const receipt = await tx.wait()
  return receipt?.hash
}

// ---------------------------------------------------------------------------
// P1 — Draft creation flow (FR-H2..H6). Replaces the removed single-tx
// createCampaignWithTasksAndReward with the actual v0.6.0 multi-step Draft sequence:
// createCampaign -> batchAddTasks -> configureERC20Reward -> fundCampaignERC20 ->
// setMaxParticipants (optional) -> openCampaign (existing, unchanged export above).
// ---------------------------------------------------------------------------

const ERC20_MIN_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]

/**
 * Timestamp (unix seconds) of the latest block on the TARGET chain — the clock
 * createCampaign's start-time check actually uses. Read through the read-only RPC provider, not
 * the wallet's: a wallet on the wrong network would otherwise hand back another chain's clock.
 * Throws rather than falling back to Date.now(), so the caller can't silently submit a start
 * time computed against a clock the contract doesn't use.
 */
export const getLatestBlockTimestamp = async (): Promise<number> => {
  const runner = getReadOnlyContract()?.runner
  const rpc = runner?.provider
  if (!rpc) throw new Error('Could not reach the network to read the current block time.')
  const block = await rpc.getBlock('latest')
  if (!block) throw new Error('Could not read the latest block.')
  return block.timestamp
}

/** Read a reward token's decimals/symbol so funding amounts are converted correctly. */
export const getERC20TokenInfo = async (
  tokenAddress: string,
): Promise<{ decimals: number; symbol: string } | null> => {
  try {
    const runner: ethers.ContractRunner | null =
      provider ?? getReadOnlyContract()?.runner ?? null
    if (!runner) return null
    const token = new ethers.Contract(tokenAddress, ERC20_MIN_ABI, runner)
    const [decimals, symbol] = await Promise.all([token.decimals(), token.symbol()])
    return { decimals: Number(decimals), symbol: String(symbol) }
  } catch (e) {
    console.warn('getERC20TokenInfo failed:', e)
    return null
  }
}

export type DraftTaskInput = {
  type: TaskType
  description: string
  verificationData?: string
  isOptional?: boolean
}

/**
 * createCampaign -> batchAddTasks, both Draft-only (FR-H2/H3). Task types route through the
 * canonical taxonomy (src/lib/task-types.ts) — no hardcoded enum numbers (Decision 2). Tasks
 * are capped at 20 by the contract; batchAddTasks itself caps at MAX_BATCH_SIZE=50, so the
 * wizard's 20-task cap always fits in a single batch call.
 */
export const createDraftCampaignWithTasks = async (params: {
  title: string
  startTime: number // unix seconds
  endTime: number
  tasks: DraftTaskInput[]
}): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract

  try {
    const tx = await contractWithSigner.createCampaign(
      params.title,
      params.startTime,
      params.endTime,
    )
    const receipt = await tx.wait()
    const event = receipt.logs
      .map((log: any) => {
        try {
          return contract?.interface.parseLog(log) || null
        } catch {
          return null
        }
      })
      .find((e: any) => e && e.name === 'CampaignCreated')
    if (!event) throw new Error('CampaignCreated event not found')
    const campaignId: bigint = event.args.campaignId

    if (params.tasks.length > 0) {
      const taskTypes = params.tasks.map((t) => toOnChainTaskType(t.type))
      const descriptions = params.tasks.map((t) => t.description)
      const verificationData = params.tasks.map((t) =>
        ethers.encodeBytes32String(t.verificationData || ''),
      )
      const isOptional = params.tasks.map((t) => t.isOptional ?? false)

      const batchTx = await contractWithSigner.batchAddTasks(
        campaignId,
        taskTypes,
        descriptions,
        verificationData,
        isOptional,
      )
      await batchTx.wait()
    }

    return campaignId.toString()
  } catch (error: any) {
    console.error('Error creating draft campaign:', error)
    const reason = mapContractRevertToMessage(error)
    toast({
      variant: 'destructive',
      title: 'Campaign Creation Failed',
      description: reason,
    })
    throw error
  }
}

/**
 * configureERC20Reward -> (approve if needed) -> fundCampaignERC20 (FR-H4/H5). All Draft-only.
 * `amountHumanReadable` is parsed against the token's OWN decimals (read on-chain), not a
 * hardcoded 18 — the old pre-v0.6.0 code assumed 18 and would have silently mis-funded any
 * token with a different decimals count.
 */
export const configureAndFundERC20Reward = async (
  campaignId: string,
  tokenAddress: string,
  amountHumanReadable: string,
): Promise<{ decimals: number; amountWei: bigint }> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const signerAddress = await signer.getAddress()
  const contractWithSigner = contract.connect(signer) as Contract

  const info = await getERC20TokenInfo(tokenAddress)
  if (!info) {
    throw new Error(
      'Could not read this token contract (decimals/symbol). Confirm the address is a deployed ERC20 token on the target chain.',
    )
  }
  const amountWei = ethers.parseUnits(amountHumanReadable, info.decimals)

  try {
    const configureTx = await contractWithSigner.configureERC20Reward(
      campaignId,
      tokenAddress,
    )
    await configureTx.wait()

    const token = new ethers.Contract(tokenAddress, ERC20_MIN_ABI, signer)
    const allowance: bigint = await token.allowance(
      signerAddress,
      config.addresses.entrypoint,
    )
    if (allowance < amountWei) {
      const approveTx = await token.approve(config.addresses.entrypoint, amountWei)
      await approveTx.wait()
    }

    const fundTx = await contractWithSigner.fundCampaignERC20(campaignId, amountWei)
    await fundTx.wait()

    return { decimals: info.decimals, amountWei }
  } catch (error: any) {
    console.error('Error configuring/funding ERC20 reward:', error)
    const reason = mapContractRevertToMessage(error)
    toast({
      variant: 'destructive',
      title: 'Funding Failed',
      description: reason,
    })
    throw error
  }
}

/** setMaxParticipants — Draft-only, optional participant cap (FR-H2, FR-T6). 0 = unlimited. */
export const setCampaignMaxParticipantsOnChain = async (
  campaignId: string,
  cap: number,
): Promise<void> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const tx = await contractWithSigner.setMaxParticipants(campaignId, cap)
    await tx.wait()
  } catch (error: any) {
    console.error('Error setting max participants:', error)
    const reason = mapContractRevertToMessage(error)
    toast({
      variant: 'destructive',
      title: 'Failed to Set Participant Cap',
      description: reason,
    })
    throw error
  }
}

/**
 * The registered fee module's rate in basis points, for the fee line (src/lib/protocol-fee.ts):
 * 0 = no fee module (fees off), null = a module is set but its rate couldn't be read. Derived
 * from computeFee on a large probe amount rather than a feeBps() getter, so it works for any
 * module honouring IFeeModule (the same flat-rate assumption as quoteProtocolFee below). If the
 * entrypoint can't be read at all, the configured address book decides: no fee module there
 * means 0, never an invented rate.
 */
export const getProtocolFeeBps = async (): Promise<number | null> => {
  try {
    const c = getEntrypointReadContract()
    const feeModule: string = await c.getFeeModule()
    if (feeModule === ethers.ZeroAddress) return 0
    const fm = new ethers.Contract(
      feeModule,
      ['function computeFee(uint256,uint256) view returns (uint256 feeAmount, address treasury)'],
      c.runner,
    )
    const probe = ethers.parseUnits('1', 24)
    const [fee]: [bigint] = await fm.computeFee(0, probe)
    return Number((fee * BigInt(10000)) / probe)
  } catch (e) {
    console.warn('getProtocolFeeBps failed:', e)
    return config.addresses.feeModule ? null : 0
  }
}

/**
 * The protocol fee fundCampaignERC20 would skim from `amountWei`, straight from the registered
 * fee module's computeFee — no hardcoded rate. The reference module ignores campaignId (flat
 * global bps), so this can be quoted before the campaign exists.
 * ASSUMPTION: quotes with campaignId 0. If a fee module that prices PER CAMPAIGN is ever
 * registered via setFeeModule, this quote (shown on the wizard's Review step) would be wrong —
 * the real id only exists after createCampaign, so the quote would have to move after creation,
 * or the fee's dependence on the id be exposed some other way. null = couldn't read it; the
 * caller must say so rather than show 0. (Quoted on the nominal amount: a fee-on-transfer token
 * that skims in transit would be charged on slightly less.)
 */
export const quoteProtocolFee = async (amountWei: bigint): Promise<bigint | null> => {
  try {
    const c = getEntrypointReadContract()
    const feeModule: string = await c.getFeeModule()
    if (feeModule === ethers.ZeroAddress) return BigInt(0)
    const fm = new ethers.Contract(
      feeModule,
      ['function computeFee(uint256,uint256) view returns (uint256 feeAmount, address treasury)'],
      c.runner,
    )
    // campaignId 0: correct only while the fee module charges a flat rate that ignores the id
    // (see the docstring) — a per-campaign module would make this quote wrong.
    const [fee]: [bigint] = await fm.computeFee(0, amountWei)
    return fee
  } catch (e) {
    console.warn('quoteProtocolFee failed:', e)
    return null
  }
}

export type RewardTokenInspection =
  | { kind: 'erc20'; symbol: string; decimals: number; balance: bigint | null }
  | { kind: 'nft'; standardMatches: boolean; notOwned: string[]; checked: number; total: number }
  | { kind: 'not_contract' } // nothing deployed at this address on the target chain
  | { kind: 'not_erc20' } // a contract, but no decimals()/symbol()
  | { kind: 'error' } // RPC failure — unknown, not a negative answer

const MAX_OWNERSHIP_CHECKS = 200

/**
 * Pre-flight look at the reward token the host typed, on the TARGET chain (read-only RPC, so a
 * wallet on the wrong network can't make a Sepolia token look missing). Everything the wizard can
 * check before any transaction: is it a contract, is it the right kind, does the host hold it.
 * Catches the mistakes that otherwise surface only after createCampaign has already mined.
 */
export const inspectRewardToken = async (params: {
  tokenAddress: string
  owner?: string | null
  kind: 'ERC20' | 'ERC721' | 'ERC1155'
  /** NFT only: the rows the host will deposit (id + quantity; quantity ignored for ERC721). */
  items?: { id: string; qty: string }[]
}): Promise<RewardTokenInspection> => {
  const rpc = getReadOnlyContract()?.runner?.provider
  if (!rpc) return { kind: 'error' }
  try {
    const code = await rpc.getCode(params.tokenAddress)
    // An EIP-7702-delegated wallet has code too (0xef0100 ‖ delegate address) — it's still a
    // wallet, not a token, so it gets the "no contract here" answer rather than "not an ERC20".
    const isDelegatedWallet = /^0xef0100[0-9a-f]{40}$/i.test(code ?? '')
    if (!code || code === '0x' || isDelegatedWallet) return { kind: 'not_contract' }
  } catch {
    return { kind: 'error' }
  }

  if (params.kind === 'ERC20') {
    const t = new ethers.Contract(
      params.tokenAddress,
      [
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function balanceOf(address) view returns (uint256)',
      ],
      rpc,
    )
    let decimals: number
    let symbol: string
    try {
      const [d, s] = await Promise.all([t.decimals(), t.symbol()])
      decimals = Number(d)
      symbol = String(s)
    } catch {
      return { kind: 'not_erc20' }
    }
    let balance: bigint | null = null
    if (params.owner) {
      try {
        balance = await t.balanceOf(params.owner)
      } catch {
        balance = null
      }
    }
    return { kind: 'erc20', symbol, decimals, balance }
  }

  // NFTs: ERC165 interface check, then ownership of each ID to be deposited.
  const INTERFACE_ID = params.kind === 'ERC721' ? '0x80ac58cd' : '0xd9b67a26'
  const nft = new ethers.Contract(
    params.tokenAddress,
    [
      'function supportsInterface(bytes4) view returns (bool)',
      'function ownerOf(uint256) view returns (address)',
      'function balanceOf(address,uint256) view returns (uint256)',
    ],
    rpc,
  )
  let standardMatches = false
  try {
    standardMatches = await nft.supportsInterface(INTERFACE_ID)
  } catch {
    standardMatches = false
  }
  const items = (params.items ?? []).filter((r) => /^\d+$/.test(r.id.trim()))
  const toCheck = items.slice(0, MAX_OWNERSHIP_CHECKS)
  const notOwned: string[] = []
  if (standardMatches && params.owner && toCheck.length) {
    const owner = params.owner.toLowerCase()
    // ERC1155: the host needs the SUM of every row for an ID, not each row on its own.
    const need = new Map<string, bigint>()
    for (const r of toCheck) {
      const qty = params.kind === 'ERC1155' && /^\d+$/.test(r.qty.trim()) ? BigInt(r.qty.trim()) : BigInt(1)
      need.set(r.id.trim(), (need.get(r.id.trim()) ?? BigInt(0)) + qty)
    }
    const ids = [...need.keys()]
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10)
      const results = await Promise.all(
        batch.map(async (id) => {
          try {
            if (params.kind === 'ERC721') {
              const o: string = await nft.ownerOf(id)
              return o.toLowerCase() === owner
            }
            const bal: bigint = await nft.balanceOf(params.owner, id)
            return bal >= (need.get(id) ?? BigInt(1))
          } catch {
            return false // ownerOf reverts for a nonexistent token — not owned either way
          }
        }),
      )
      results.forEach((ok, j) => {
        if (!ok) notOwned.push(batch[j])
      })
    }
  }
  return { kind: 'nft', standardMatches, notOwned, checked: toCheck.length, total: items.length }
}

// ---------------------------------------------------------------------------
// P1 — Merkle settlement: host publish + participant self-claim (FR-M3, FR-C2, BR-M3)
// ---------------------------------------------------------------------------

/** Host-signed setERC20MerkleRoot — the pipeline PROPOSES, the host PUBLISHES (BR-M3). */
export const submitERC20MerkleRoot = async (
  campaignId: string,
  root: string,
): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const tx = await contractWithSigner.setERC20MerkleRoot(campaignId, root)
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    // Re-thrown unmapped: mapContractRevertToMessage runs once, at the UI layer, against
    // this original error object (its .reason/.shortMessage fields are what it inspects —
    // wrapping in a plain Error here would lose them).
    console.error('Error publishing Merkle root:', error)
    throw error
  }
}

/** Self-claim: claimERC20(campaignId, amount, proof) from the connected wallet (FR-C2). */
export const claimERC20Reward = async (
  campaignId: string,
  amount: string,
  proof: string[],
): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const tx = await contractWithSigner.claimERC20(campaignId, amount, proof)
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error('Error claiming ERC20 reward:', error)
    throw error
  }
}

/**
 * NFR-10: map every contract revert reachable from the UI to a specific, actionable message — a
 * raw revert string reaching the user is a defect. Since contracts PR #26 every revert is a
 * custom error, so this decodes the revert data against the ABIs (src/lib/contract-errors.ts)
 * instead of matching text. Kept as the service's export so existing call sites don't change.
 */
export const mapContractRevertToMessage = (error: any): string =>
  contractErrorMessage(error, { gasSymbol: DEPLOYMENT_CHAIN.gasSymbol })

/**
 * Direct-RPC settlement read for the claim UI's value-bearing checks (BR-I4) — never trust
 * the indexer alone for whether a claim will actually succeed. Combines getERC20Settlement,
 * getERC20ClaimableAt, and hasClaimedERC20 into one call site.
 */
export const getERC20SettlementOnChain = async (
  campaignId: string,
  wallet?: string,
): Promise<{
  token: string
  escrowed: bigint
  distributed: bigint
  merkleRoot: string
  closedAt: number
  swept: boolean
  claimableAt: number
  hasClaimed: boolean
}> => {
  const c = getEntrypointReadContract()
  const [settlement, claimableAt, hasClaimed] = await Promise.all([
    c.getERC20Settlement(campaignId),
    c.getERC20ClaimableAt(campaignId),
    wallet ? c.hasClaimedERC20(campaignId, wallet) : Promise.resolve(false),
  ])
  return {
    token: settlement.token,
    escrowed: settlement.escrowed,
    distributed: settlement.distributed,
    merkleRoot: settlement.merkleRoot,
    closedAt: Number(settlement.closedAt),
    swept: settlement.swept,
    claimableAt: Number(claimableAt),
    hasClaimed,
  }
}

/**
 * Direct-RPC NFT settlement read (BR-I4), mirroring getERC20SettlementOnChain — resolves the
 * campaign's PINNED module first (never a default), then reads its root/claimable-at state.
 * Returns undefined if the campaign never pinned an NFT module (no deposit yet). The
 * leaf-claimed check is a separate call (isNFTLeafClaimedOnChain) since the leaf itself depends
 * on which AllocationEntry the caller resolves AFTER seeing the root — a two-phase lookup, same
 * shape as the ERC20 proof API's own root-then-entry sequence.
 */
export const getNFTSettlementOnChain = async (
  campaignId: string,
): Promise<{ moduleAddress: string; merkleRoot: string; claimableAt: number } | undefined> => {
  const moduleAddress = await getPinnedNFTModule(campaignId)
  if (!moduleAddress) return undefined
  const c = getNFTSettlementModuleContract(moduleAddress, getReadOnlyContract()!.runner!)
  const [merkleRoot, claimableAt] = await Promise.all([
    c.getNFTMerkleRoot(campaignId),
    c.getNFTClaimableAt(campaignId),
  ])
  return { moduleAddress, merkleRoot, claimableAt: Number(claimableAt) }
}

/** Whether a specific NFT leaf has already been claimed, read directly against the given
 * module address (the caller must have already resolved it, e.g. via getNFTSettlementOnChain). */
export const isNFTLeafClaimedOnChain = async (
  moduleAddress: string,
  campaignId: string,
  leaf: string,
): Promise<boolean> => {
  const c = getNFTSettlementModuleContract(moduleAddress, getReadOnlyContract()!.runner!)
  return c.isNFTLeafClaimed(campaignId, leaf)
}

export const completeTask = async (campaignId: string, taskIndex: number) => {
  if (!contract) throw new Error('Contract not initialized')

  // This function is called with the user's connected wallet.
  // The smart contract automatically uses msg.sender as the participant.
  const signer = await getSigner()
  const signerAddress = await signer.getAddress()
  const walletNetwork = provider ? await provider.getNetwork() : null
  let contractWithSigner = contract.connect(signer) as Contract

  try {
    if (provider) {
      const network = await provider.getNetwork()
      if (network.chainId !== BigInt(config.chainId)) {
        if (window.ethereum) {
          await switchOrAddTargetNetwork(window.ethereum as any)
          // Refresh signer/contract after network switch
          const providerRefresh = new ethers.BrowserProvider(window.ethereum)
          const signerRefresh = await providerRefresh.getSigner()
          contractWithSigner = contract.connect(signerRefresh) as Contract
        } else {
          throw new Error('Please switch to the target network in your wallet.')
        }
      }
    }

    // Convert campaignId from string to number for all smart contract calls
    const campaignIdNumber = parseInt(campaignId, 10)
    const userAddress = await signer.getAddress()

    console.log('Attempting to complete task:', {
      campaignId: campaignIdNumber,
      taskIndex,
      userAddress,
      signerAddress,
      walletChainId:
        walletNetwork?.chainId?.toString?.() ?? walletNetwork?.chainId,
    })

    // First, let's check the campaign status and other details
    const contractToRead = readOnlyContract || contractWithSigner
    const campaignData = await contractToRead.getCampaign(campaignIdNumber)
    console.log('Campaign data before task completion:', {
      id: campaignData.id.toString(),
      status: campaignData.status.toString(),
      host: campaignData.host,
      tasksLength: campaignData.tasks.length,
      requestedTaskIndex: taskIndex,
      startTime: Number(campaignData.startTime),
      endTime: Number(campaignData.endTime),
      now: Math.floor(Date.now() / 1000),
    })

    // Check if campaign is in Open status (should be 1)
    if (Number(campaignData.status) !== 1) {
      throw new Error(
        `Campaign is not open. Current status: ${campaignData.status} (should be 1 for Open)`,
      )
    }

    // Check if task index is valid
    if (taskIndex >= campaignData.tasks.length) {
      throw new Error(
        `Invalid task index ${taskIndex}. Campaign has ${campaignData.tasks.length} tasks.`,
      )
    }

    // Check if the user is the campaign host — the contract rejects hosts
    // completing their own tasks (Web3Campaigns__PosterCannotAcceptOwnTask)
    if (
      campaignData.host &&
      userAddress.toLowerCase() === campaignData.host.toLowerCase()
    ) {
      throw new Error(
        'Campaign hosts cannot complete tasks on their own campaign. Please use a different wallet.',
      )
    }

    // Check if the task is already completed on-chain
    try {
      const alreadyCompleted = await contractToRead.hasCompletedTask(
        campaignIdNumber,
        userAddress,
        taskIndex,
      )
      if (alreadyCompleted) {
        throw new Error('You have already completed this task.')
      }
    } catch (checkErr: any) {
      // If it's our own error, re-throw. Otherwise ignore and let the contract call handle it.
      if (checkErr.message === 'You have already completed this task.')
        throw checkErr
      console.warn(
        'Pre-check hasCompletedTask failed, proceeding anyway:',
        checkErr?.message,
      )
    }

    // The smart contract completeTask function only takes campaignId and taskIndex
    // It automatically uses msg.sender (the connected wallet) as the participant
    console.log('Calling smart contract completeTask...', {
      campaignIdNumber,
      taskIndex,
    })

    // Since contracts PR #24, completeTask self-verifies ONLY the two hold types
    // (ONCHAIN_HOLD_ERC20 = 8, ONCHAIN_HOLD_ERC721 = 9). Every other type reverts
    // NotSelfVerifiable: it settles through the signer's attestation instead
    // (/api/verify-task, then submitAttestationFromWallet as the fallback). Refuse it here, before
    // the wallet is asked to pay gas for a certain revert. If the read fails, the staticCall
    // below still stops a doomed transaction.
    let taskTypeOnChain: number | null = null
    try {
      const taskData = await contractToRead.getCampaignTask(campaignIdNumber, taskIndex)
      taskTypeOnChain = Number(taskData.taskType)
    } catch (e) {
      console.warn('Could not read the task type; the staticCall pre-flight decides:', e)
    }
    if (
      taskTypeOnChain !== null &&
      taskTypeOnChain !== OnChainTaskType.ONCHAIN_HOLD_ERC20 &&
      taskTypeOnChain !== OnChainTaskType.ONCHAIN_HOLD_ERC721
    ) {
      throw new Error('This task is checked by DappDrop’s verifier, not by a wallet transaction. Use the task’s Start button.')
    }

    // Hold tasks check a token balance in-transaction, which can make estimateGas fail with
    // "missing revert data" on RPCs that don't return custom-error data. So: staticCall first
    // (a real revert surfaces as a decodable error); on "missing revert data" only, send with a
    // manual gas limit.
    let tx
    try {
      await contractWithSigner.completeTask.staticCall(campaignIdNumber, taskIndex)
      tx = await contractWithSigner.completeTask(campaignIdNumber, taskIndex)
    } catch (staticErr: any) {
      const noRevertData =
        contractErrorName(staticErr) === null &&
        (staticErr?.shortMessage?.includes('missing revert data') ||
          staticErr?.message?.includes('missing revert data') ||
          (staticErr?.code === 'CALL_EXCEPTION' && staticErr?.data === null))
      if (!noRevertData) throw staticErr
      console.warn('completeTask staticCall returned no revert data; sending with a manual gas limit')
      tx = await contractWithSigner.completeTask(campaignIdNumber, taskIndex, { gasLimit: 300000 })
    }

    console.log('Transaction sent:', tx.hash)
    await tx.wait()

    console.log('Task completed successfully!')
  } catch (error: any) {
    console.error('completeTask failed:', error)

    // A decodable custom error, a wallet rejection, or our own pre-check message: map it once
    // (src/lib/contract-errors.ts). Only a revert with no data at all goes further.
    if (contractErrorName(error) !== null || error?.code !== 'CALL_EXCEPTION') {
      throw new Error(mapContractRevertToMessage(error))
    }

    // No revert data (some RPCs, or a mined revert): simulate once to get it.
    try {
      await contractWithSigner.completeTask.staticCall(parseInt(campaignId, 10), taskIndex)
    } catch (simError: any) {
      if (contractErrorName(simError) !== null) throw new Error(mapContractRevertToMessage(simError))
    }

    let description = 'Failed to complete task.'
    // Last resort: check the campaign's current state to give a specific reason
    try {
      const contractToRead = readOnlyContract || contractWithSigner
      if (contractToRead) {
        const campaignIdNumber = parseInt(campaignId, 10)
        const campaignData =
          await contractToRead.getCampaign(campaignIdNumber)
        const userAddress = await (await getSigner()).getAddress()
        const now = Math.floor(Date.now() / 1000)

        if (Number(campaignData.status) !== 1) {
          description = `Campaign is not open. Current status: ${['Draft', 'Open', 'Ended', 'Closed', 'Cancelled'][Number(campaignData.status)] || campaignData.status}.`
        } else if (
          userAddress.toLowerCase() === campaignData.host.toLowerCase()
        ) {
          description =
            'Campaign hosts cannot complete tasks on their own campaign. Please use a different wallet.'
        } else if (now > Number(campaignData.endTime)) {
          description = 'This campaign has ended. The end time has passed.'
        } else if (now < Number(campaignData.startTime)) {
          description = 'Campaign start time has not been reached yet.'
        } else {
          // Check if task already completed
          try {
            const alreadyDone = await contractToRead.hasCompletedTask(
              campaignIdNumber,
              userAddress,
              taskIndex,
            )
            if (alreadyDone) {
              description = 'You have already completed this task.'
            } else {
              description =
                'Transaction rejected by the smart contract. The campaign is active and the task is not yet completed. Please check the browser console for more details and try again.'
            }
          } catch {
            description =
              'Transaction rejected by the smart contract. Please check the browser console for more details and try again.'
          }
        }
      }
    } catch (diagError) {
      console.warn('Diagnostic check failed:', diagError)
      description =
        'Transaction rejected by the smart contract. Please check the browser console for more details and try again.'
    }

    console.error('Parsed error description:', description)
    throw new Error(description)
  }
}

/**
 * Self-submit fallback for an attested task (BR-V3). When the backend signed a
 * TaskAttestation but could not submit it (relayer down/unfunded), the connected wallet
 * submits `verifyTaskCompletionWithSignature` itself using the returned signature. The
 * recovered signer must hold SIGNER_ROLE, so a user cannot forge completion this way — they
 * can only broadcast an attestation the backend already signed for them.
 */
export const submitAttestationFromWallet = async (
  campaignId: string,
  participant: string,
  taskIndex: number,
  completed: boolean,
  deadline: number,
  signature: string,
) => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  const tx = await contractWithSigner.verifyTaskCompletionWithSignature(
    parseInt(campaignId, 10),
    participant,
    taskIndex,
    completed,
    deadline,
    signature,
  )
  const receipt = await tx.wait()
  return receipt?.hash as string | undefined
}

// Function to check if a user has completed specific tasks in a campaign
export const getUserTaskCompletionStatus = async (
  campaignId: string,
  userAddress: string,
  tasks: any[],
): Promise<{ [taskId: string]: boolean }> => {
  // Try to use the wallet contract first, then fallback to read-only
  let contractToUse = contract ?? readOnlyContract

  if (!contractToUse) {
    initializeReadOnlyProvider()
    contractToUse = readOnlyContract
  }

  if (!contractToUse || !userAddress) return {}

  try {
    const completionStatus: { [taskId: string]: boolean } = {}

    // Initialize all tasks as not completed first
    tasks.forEach((task) => {
      completionStatus[task.id] = false
    })

    console.log('Checking task completion for:', {
      campaignId,
      userAddress,
      taskCount: tasks.length,
      taskIds: tasks.map((t) => t.id),
    })

    const campaignIdNumber = parseInt(campaignId, 10)
    if (Number.isNaN(campaignIdNumber)) {
      return completionStatus
    }

    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
      const task = tasks[taskIndex]
      try {
        const isCompleted = await contractToUse.hasCompletedTask(
          campaignIdNumber,
          userAddress,
          taskIndex,
        )
        completionStatus[task.id] = Boolean(isCompleted)
      } catch (taskError: any) {
        console.warn('Failed to check task completion status:', {
          campaignId: campaignIdNumber,
          taskIndex,
          userAddress,
          error: taskError?.message || 'Unknown error',
        })
      }
    }

    console.log('Task completion status for user:', {
      userAddress,
      campaignId,
      completionStatus,
      method: 'hasCompletedTask',
      taskIds: tasks.map((t) => t.id),
    })

    return completionStatus
  } catch (error: any) {
    if (error?.code === 'BAD_DATA' || error?.code === 'CALL_EXCEPTION') {
      console.warn(
        `Campaign ${campaignId} task completion data not found/reverted for ${userAddress}.`,
      )
    } else {
      console.warn(
        'Error checking user task completion status:',
        error?.message || 'Unknown error',
      )
    }
    console.warn('Error details:', {
      campaignId,
      userAddress,
      taskCount: tasks.length,
      contractAddress: config.campaignFactoryAddress,
      error: error instanceof Error ? error.message : String(error),
    })

    // Return all tasks as not completed if there's an error
    const completionStatus: { [taskId: string]: boolean } = {}
    tasks.forEach((task) => {
      completionStatus[task.id] = false
    })
    return completionStatus
  }
}

// Function to get basic participant addresses for a campaign
export const getCampaignParticipantAddresses = async (
  campaignId: string,
): Promise<string[]> => {
  // TTL + in-flight dedup cover BOTH the Graph fast path and the RPC fallback
  // below, so repeated calls (e.g. host analytics re-renders) don't re-hit
  // the network every time.
  const cacheKey = `${config.chainId}:${config.campaignFactoryAddress ?? 'unknown'}:${campaignId}`
  const cached = participantAddressesCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.updatedAt < PARTICIPANT_CACHE_TTL_MS) {
    return cached.addresses
  }

  if (cached?.inFlight) {
    return cached.inFlight
  }

  const fetchPromise = (async () => {
    // --- Fast path: The Graph subgraph (replaces chunked event log scanning) ---
    const graphResult = await getGraphParticipantAddresses(campaignId)
    if (graphResult !== null) {
      participantAddressesCache.set(cacheKey, {
        addresses: graphResult,
        lastBlock: cached?.lastBlock ?? 0,
        updatedAt: Date.now(),
      })
      return graphResult
    }

    // --- Fallback: event log scan (original behaviour) ---
    console.log(
      'getCampaignParticipantAddresses called with campaignId:',
      campaignId,
    )

    let contractToUse = getReadOnlyContract() ?? contract

    if (!contractToUse) {
      console.log('No contract available after initialization')
      return cached?.addresses ?? []
    }

    let providerInstance = contractToUse.runner as ethers.Provider | null
    if (
      !providerInstance ||
      typeof providerInstance.getBlockNumber !== 'function'
    ) {
      providerInstance = new ethers.JsonRpcProvider(TARGET_RPC_URL)
      contractToUse = new ethers.Contract(
        config.campaignFactoryAddress!,
        Web3Campaigns.abi,
        providerInstance,
      )
    }
    console.log('Using provider:', providerInstance?.constructor?.name)

    const latestBlock = await providerInstance.getBlockNumber()
    const cachedLastBlock = cached?.lastBlock ?? null
    const startBlock = cachedLastBlock
      ? Math.min(cachedLastBlock + 1, latestBlock)
      : Math.max(0, latestBlock - 49999)

    if (startBlock > latestBlock) {
      return cached?.addresses ?? []
    }

    console.log('Querying events from block', startBlock, 'to', latestBlock)

    const filter = contractToUse.filters.ParticipantTaskCompleted(campaignId)
    console.log('Filter created:', filter)

    const events: any[] = []
    let chunkSize = MAX_LOG_RANGE_FALLBACK

    const parseLogRangeLimit = (message: string): number | null => {
      const rangeMatch = message.match(/up to a (\d+) block range/i)
      if (rangeMatch?.[1]) {
        const maxRange = Number(rangeMatch[1])
        if (!Number.isNaN(maxRange)) {
          return Math.max(1, maxRange - 1)
        }
      }

      const recommendedMatch = message.match(
        /\[(0x[0-9a-fA-F]+),\s*(0x[0-9a-fA-F]+)\]/,
      )
      if (recommendedMatch?.[1] && recommendedMatch?.[2]) {
        const from = Number.parseInt(recommendedMatch[1], 16)
        const to = Number.parseInt(recommendedMatch[2], 16)
        if (!Number.isNaN(from) && !Number.isNaN(to) && to >= from) {
          return Math.max(1, to - from)
        }
      }

      return null
    }

    let fromBlock = startBlock
    while (fromBlock <= latestBlock) {
      const toBlock = Math.min(fromBlock + chunkSize, latestBlock)

      try {
        const chunkEvents = await contractToUse.queryFilter(
          filter,
          fromBlock,
          toBlock,
        )
        if (chunkEvents.length) {
          events.push(...chunkEvents)
        }
        fromBlock = toBlock + 1
      } catch (error: any) {
        const errorMessage =
          error?.error?.message || error?.shortMessage || error?.message || ''
        const maxRange = parseLogRangeLimit(errorMessage)

        if (maxRange && maxRange < chunkSize) {
          chunkSize = Math.max(1, maxRange)
          console.warn('Reducing log query range due to RPC limits:', {
            chunkSize,
            errorMessage,
          })
          continue
        }

        throw error
      }
    }

    console.log('Raw events found:', events.length, events)

    const participantSet = new Set<string>(
      (cached?.addresses ?? []).map((address) => address.toLowerCase()),
    )

    events.forEach((event: any, index) => {
      console.log(`Event ${index}:`, event.args)
      const participant = event.args?.[1]
      if (participant) {
        console.log('Adding participant:', participant)
        participantSet.add(participant.toLowerCase())
      }
    })

    const participantAddresses = Array.from(participantSet)
    console.log('Found participant addresses:', {
      campaignId,
      addresses: participantAddresses,
      eventsCount: events.length,
    })

    participantAddressesCache.set(cacheKey, {
      addresses: participantAddresses,
      lastBlock: latestBlock,
      updatedAt: Date.now(),
    })

    return participantAddresses
  })()

  participantAddressesCache.set(cacheKey, {
    addresses: cached?.addresses ?? [],
    lastBlock: cached?.lastBlock ?? 0,
    updatedAt: cached?.updatedAt ?? 0,
    inFlight: fetchPromise,
  })

  try {
    return await fetchPromise
  } catch (error: any) {
    if (error?.code === 'BAD_DATA' || error?.code === 'CALL_EXCEPTION') {
      console.warn(
        `Campaign ${campaignId} participants not found/reverted (probably uncreated).`,
      )
    } else {
      console.warn(
        'Error fetching participant addresses:',
        error?.message || 'Unknown error',
      )
    }
    return cached?.addresses ?? []
  } finally {
    const latest = participantAddressesCache.get(cacheKey)
    if (latest?.inFlight === fetchPromise) {
      participantAddressesCache.set(cacheKey, {
        addresses: latest.addresses,
        lastBlock: latest.lastBlock,
        updatedAt: latest.updatedAt,
      })
    }
  }
}

export const getCampaignParticipants = async (
  campaign: Campaign,
): Promise<ParticipantData[]> => {
  // TTL + in-flight dedup cover BOTH the Graph fast path and the RPC fallback
  // below, so repeated calls (e.g. host analytics re-renders) don't re-hit
  // the network every time.
  const cacheKey = `${config.chainId}:${config.campaignFactoryAddress ?? 'unknown'}:${campaign.id}`
  const cached = participantDetailsCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.updatedAt < PARTICIPANT_DETAIL_CACHE_TTL_MS) {
    return cached.data
  }

  if (cached?.inFlight) {
    return cached.inFlight
  }

  const fetchPromise = (async () => {
    // --- Fast path: The Graph subgraph (replaces M×T hasCompletedTask RPC calls) ---
    const graphResult = await getGraphParticipants(campaign.id)
    if (graphResult !== null) {
      participantDetailsCache.set(cacheKey, {
        data: graphResult,
        updatedAt: Date.now(),
      })
      return graphResult
    }

    // --- Fallback: per-participant RPC calls (original behaviour) ---
    const contractToUse = getReadOnlyContract() ?? contract
    if (!contractToUse) return cached?.data ?? []

    const campaignIdNumber = Number(campaign.id)
    if (Number.isNaN(campaignIdNumber)) return []

    const participantAddresses = await getCampaignParticipantAddresses(
      String(campaign.id),
    )

    if (participantAddresses.length === 0) {
      participantDetailsCache.set(cacheKey, {
        data: [],
        updatedAt: Date.now(),
      })
      return []
    }

    const tasksCount = campaign.tasks.length

    const participantData = await runWithConcurrency(
      participantAddresses,
      PARTICIPANT_QUERY_CONCURRENCY,
      async (address) => {
        // TODO(P1): `hasClaimedReward` still exists in the v0.6.0 ABI but is not the
        // authoritative claim signal for escrow settlement. Claim status must be read
        // per settlement mode: hasClaimedERC20(id, account) for Merkle ERC20,
        // NFTSettlementModule.isNFTLeafClaimed for NFT, tiered module state for tiered.
        // See docs/GAP_ANALYSIS_v0.6.0.md §2.1.
        const hasClaimed = await contractToUse.hasClaimedReward(
          campaignIdNumber,
          address,
        )

        let completedTasksCount = 0
        for (let taskIndex = 0; taskIndex < tasksCount; taskIndex += 1) {
          const completed = await contractToUse.hasCompletedTask(
            campaignIdNumber,
            address,
            taskIndex,
          )
          if (completed) completedTasksCount += 1
        }

        return {
          address,
          tasksCompleted: completedTasksCount,
          claimed: Boolean(hasClaimed),
        }
      },
    )

    participantDetailsCache.set(cacheKey, {
      data: participantData,
      updatedAt: Date.now(),
    })

    return participantData
  })()

  participantDetailsCache.set(cacheKey, {
    data: cached?.data ?? [],
    updatedAt: cached?.updatedAt ?? 0,
    inFlight: fetchPromise,
  })

  try {
    return await fetchPromise
  } catch (error: any) {
    if (error?.code === 'BAD_DATA' || error?.code === 'CALL_EXCEPTION') {
      console.warn(
        `Campaign ${campaign.id} participant data not found/reverted.`,
      )
    } else {
      console.warn(
        'Error fetching participants:',
        error?.message || 'Unknown error',
      )
    }
    toast({
      variant: 'destructive',
      title: 'Error',
      description: 'Could not fetch participant data.',
    })
    return cached?.data ?? []
  } finally {
    const latest = participantDetailsCache.get(cacheKey)
    if (latest?.inFlight === fetchPromise) {
      participantDetailsCache.set(cacheKey, {
        data: latest.data,
        updatedAt: latest.updatedAt,
      })
    }
  }
}

export const isPaused = async (): Promise<boolean> => {
  const now = Date.now()
  if (pausedCache && now - pausedCache.updatedAt < PAUSED_CACHE_TTL_MS) {
    return pausedCache.value
  }

  if (pausedCache?.inFlight) {
    return pausedCache.inFlight
  }

  const fetchPromise = (async () => {
    const contractToUse = getReadOnlyContract()
    if (!contractToUse) return pausedCache?.value ?? false
    try {
      const value = await contractToUse.paused()
      return Boolean(value)
    } catch (error) {
      console.error('Error checking for paused state:', error)
      return pausedCache?.value ?? false
    }
  })()

  pausedCache = {
    value: pausedCache?.value ?? false,
    updatedAt: pausedCache?.updatedAt ?? 0,
    inFlight: fetchPromise,
  }

  try {
    const value = await fetchPromise
    pausedCache = { value, updatedAt: Date.now() }
    return value
  } finally {
    if (pausedCache?.inFlight === fetchPromise) {
      pausedCache = {
        value: pausedCache.value,
        updatedAt: pausedCache.updatedAt,
      }
    }
  }
}

// ---------------------------------------------------------------------------
// P3 CP4 — Admin console: moderation + emergency-pause actions, all signed by the CONNECTED
// wallet's own signer (never a backend key) — the admin console is a UI convenience over the
// same "you sign your own privileged tx" pattern hosts already use, not a new trust model.
// The actual authorization gate is on-chain (onlyRole(MODERATOR_ROLE)/onlyRole(EMERGENCY_ADMIN)
// in the contract); the API-route-level checks in src/lib/admin-auth.ts are a UX nicety
// (fail fast with a clear message) layered on top of that, not a substitute for it.
// ---------------------------------------------------------------------------

/** MODERATOR_ROLE: flag (score > 0) or clear (score = 0) an account's suspicious-activity
 * score. MAX_SUSPICIOUS_SCORE (100) blocks the account from completing tasks entirely. */
export const flagAccountOnChain = async (userAddress: string, score: number): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const tx = await contractWithSigner.flagAccount(userAddress, score)
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error('Error flagging account:', error)
    throw error
  }
}

/** EMERGENCY_ADMIN: pause all state-changing entrypoints platform-wide. */
export const emergencyPauseOnChain = async (): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const tx = await contractWithSigner.emergencyPause()
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error('Error pausing contract:', error)
    throw error
  }
}

/** EMERGENCY_ADMIN: lift a platform-wide pause. */
export const emergencyUnpauseOnChain = async (): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract
  try {
    const tx = await contractWithSigner.emergencyUnpause()
    const receipt = await tx.wait()
    return receipt?.hash
  } catch (error: any) {
    console.error('Error unpausing contract:', error)
    throw error
  }
}

export type FlagEvent = { user: string; score: number; moderator: string; blockNumber: number; timestamp: number }

/** Recent AccountFlagged events (the only way to see moderation history — _suspiciousActivityScore
 * has no getter, only the event trail). Bounded scan, same probe-then-concurrent-fetch shape as
 * getClaimEvents (see its docstring for why: this deployment's RPC hard-caps eth_getLogs). */
export const getRecentFlagEvents = async (lookbackBlocks = 50000): Promise<FlagEvent[]> => {
  const c = getEntrypointReadContract()
  const provider = c.runner as ethers.Provider
  const latestBlock = await provider.getBlockNumber()
  const fromBlockBase = Math.max(config.addresses.deployBlock || 0, latestBlock - lookbackBlocks)
  const filter = c.filters.AccountFlagged()

  let chunkSize = MAX_LOG_RANGE_FALLBACK
  try {
    await c.queryFilter(filter, fromBlockBase, Math.min(fromBlockBase + chunkSize, latestBlock))
  } catch (error: any) {
    const msg: string = error?.error?.message || error?.shortMessage || error?.message || ''
    const rangeMatch = msg.match(/up to a (\d+) block range/i)
    if (rangeMatch?.[1]) chunkSize = Math.max(1, Number(rangeMatch[1]))
  }
  let ranges: { from: number; to: number }[] = []
  for (let from = fromBlockBase; from <= latestBlock; from += chunkSize) {
    ranges.push({ from, to: Math.min(from + chunkSize - 1, latestBlock) })
  }
  const MAX_CHUNKS = 200
  if (ranges.length > MAX_CHUNKS) ranges = ranges.slice(-MAX_CHUNKS)

  const chunkResults = await runWithConcurrency(ranges, 4, async ({ from, to }) => {
    try {
      return await c.queryFilter(filter, from, to)
    } catch {
      return []
    }
  })
  const logs = chunkResults.flat()

  const uniqueBlocks = Array.from(new Set(logs.map((l) => l.blockNumber)))
  const blockTimestamps = new Map<number, number>()
  await runWithConcurrency(uniqueBlocks, PARTICIPANT_QUERY_CONCURRENCY, async (bn) => {
    const block = await provider.getBlock(bn)
    if (block) blockTimestamps.set(bn, block.timestamp)
  })

  return logs.map((log) => {
    const parsed = c.interface.parseLog(log)
    return {
      user: (parsed?.args?.user as string) ?? '',
      score: Number(parsed?.args?.score ?? 0),
      moderator: (parsed?.args?.moderator as string) ?? '',
      blockNumber: log.blockNumber,
      timestamp: blockTimestamps.get(log.blockNumber) ?? 0,
    }
  })
}

export type SettlerActivityEvent = {
  campaignId: number
  settler: string
  kind: 'root_published' | 'closed'
  blockNumber: number
  timestamp: number
}

/** Recent SETTLER_ROLE fallback activity (FallbackRootPublished / FallbackClosed) — the
 * "last-fallback-action-at" health signal. Same bounded-scan shape as getRecentFlagEvents. */
export const getRecentSettlerActivity = async (lookbackBlocks = 50000): Promise<SettlerActivityEvent[]> => {
  const c = getEntrypointReadContract()
  const provider = c.runner as ethers.Provider
  const latestBlock = await provider.getBlockNumber()
  const fromBlockBase = Math.max(config.addresses.deployBlock || 0, latestBlock - lookbackBlocks)

  let chunkSize = MAX_LOG_RANGE_FALLBACK
  try {
    await c.queryFilter(c.filters.FallbackRootPublished(), fromBlockBase, Math.min(fromBlockBase + chunkSize, latestBlock))
  } catch (error: any) {
    const msg: string = error?.error?.message || error?.shortMessage || error?.message || ''
    const rangeMatch = msg.match(/up to a (\d+) block range/i)
    if (rangeMatch?.[1]) chunkSize = Math.max(1, Number(rangeMatch[1]))
  }
  let ranges: { from: number; to: number }[] = []
  for (let from = fromBlockBase; from <= latestBlock; from += chunkSize) {
    ranges.push({ from, to: Math.min(from + chunkSize - 1, latestBlock) })
  }
  const MAX_CHUNKS = 150
  if (ranges.length > MAX_CHUNKS) ranges = ranges.slice(-MAX_CHUNKS)

  const [publishedChunks, closedChunks] = await Promise.all([
    runWithConcurrency(ranges, 4, async ({ from, to }) => {
      try {
        return await c.queryFilter(c.filters.FallbackRootPublished(), from, to)
      } catch {
        return []
      }
    }),
    runWithConcurrency(ranges, 4, async ({ from, to }) => {
      try {
        return await c.queryFilter(c.filters.FallbackClosed(), from, to)
      } catch {
        return []
      }
    }),
  ])
  const logs = [
    ...publishedChunks.flat().map((l) => ({ log: l, kind: 'root_published' as const })),
    ...closedChunks.flat().map((l) => ({ log: l, kind: 'closed' as const })),
  ]

  const uniqueBlocks = Array.from(new Set(logs.map((l) => l.log.blockNumber)))
  const blockTimestamps = new Map<number, number>()
  await runWithConcurrency(uniqueBlocks, PARTICIPANT_QUERY_CONCURRENCY, async (bn) => {
    const block = await provider.getBlock(bn)
    if (block) blockTimestamps.set(bn, block.timestamp)
  })

  return logs
    .map(({ log, kind }) => {
      const parsed = c.interface.parseLog(log)
      return {
        campaignId: Number(parsed?.args?.campaignId ?? 0),
        settler: (parsed?.args?.settler as string) ?? '',
        kind,
        blockNumber: log.blockNumber,
        timestamp: blockTimestamps.get(log.blockNumber) ?? 0,
      }
    })
    .sort((a, b) => b.blockNumber - a.blockNumber)
}
