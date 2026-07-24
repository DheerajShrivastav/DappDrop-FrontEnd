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
import { addDays, endOfDay, differenceInSeconds } from 'date-fns'
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
  const rewardName =
    campaignMetadata?.rewardName || `Reward for ${contractData.name}`

  // Use stored descriptions if available, otherwise fall back to generated placeholders
  const shortDescription = campaignMetadata?.shortDescription || `A campaign hosted by ${contractData.host}`
  const longDescription = campaignMetadata?.longDescription || `A campaign hosted by ${contractData.host} with the name ${contractData.name}. More details can be found on the blockchain.`

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
    imageUrl: imageUrl || `https://placehold.co/600x400`,
    'data-ai-hint': 'blockchain technology',
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

export const getAllCampaigns = async (): Promise<Campaign[]> => {
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
      toast({
        variant: 'destructive',
        title: 'Contract Error',
        description:
          'Could not connect to the campaign contract. Please check your configuration and network.',
      })
      return []
    }
    return getAllCampaigns()
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
          if (typeof window !== 'undefined') {
            try {
              const imageResponse = await fetch(`/api/campaigns/${i}/image`)
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
            i,
            undefined,
            imageUrl,
            campaignMeta,
          )

          campaigns.push(campaign)
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
      toast({
        variant: 'destructive',
        title: 'Contract Error',
        description:
          'Could not connect to the campaign contract. Please check your configuration and network.',
      })
    } else {
      console.error('Error fetching campaigns:', error)
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

    // Mode derivation from cheap entrypoint reads. NOTE: rank-vs-score is not distinguishable
    // here without a module read, so a tiered campaign resolves to a generic tiered mode on
    // this RPC path — the subgraph reports the exact one. Lifecycle behavior is identical for
    // both tiered variants (claims open at Ended, no dispute window), so this is display-only
    // imprecision. TODO(P1): read the pinned module to label rank vs score precisely.
    let mode: SettlementMode = 'UNSET'
    if (hasErc20Root) mode = 'MERKLE_ERC20'
    else if (nftPinned) mode = 'NFT'
    else if (rewardPinned) mode = 'RANK_TIERED'

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
      rewardModule: rewardPinned ? rewardModule : undefined,
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

export const createAndActivateCampaign = async (campaignData: any) => {
  console.log('🚀 === createAndActivateCampaign FUNCTION CALLED ===')
  console.log(
    '📋 Campaign data received:',
    JSON.stringify(campaignData, null, 2),
  )

  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract

  // ── QUARANTINED (v0.6.0) ──────────────────────────────────────────────────────────
  // TODO(P1): `createCampaignWithTasksAndReward` was REMOVED in v0.6.0 (it baked the old
  // direct-reward model into one tx). Rebuild this as the multi-step Draft flow:
  //   createCampaign → batchAddTasks/addTaskToCampaign → configureERC20Reward +
  //   fundCampaignERC20 (or depositERC721/1155Rewards, or module setRankTiers/setScoreTiers)
  //   → openCampaign. See docs/GAP_ANALYSIS_v0.6.0.md §2.4 and PRD FR-H2..H6. The legacy
  //   body below is retained as reference and is intentionally unreachable.
  throw new Error(
    'Campaign creation is being rebuilt for the v0.6.0 escrow/settlement contracts (P1). ' +
      'The single-transaction create+reward path no longer exists on-chain.',
  )

  // Use the actual dates provided by the user, but ensure start time is not in the past
  const now = Math.floor(Date.now() / 1000)
  const userStartTime = Math.floor(campaignData.dates.from.getTime() / 1000)
  const userEndTime = Math.floor(campaignData.dates.to.getTime() / 1000)

  // If user's start time is in the past, set it to current time + 1 minute
  const actualStartTime = userStartTime < now ? now + 60 : userStartTime
  const actualEndTime = userEndTime

  // Check if localStorage is available (not server-side)
  const hasLocalStorage = typeof window !== 'undefined' && window.localStorage

  try {
    // Prepare task arrays for unified call
    const taskTypes: number[] = []
    const descriptions: string[] = []
    const verificationDatas: string[] = []
    const isOptionals: boolean[] = []

    for (const task of campaignData.tasks) {
      // Route through the canonical taxonomy — never hardcode enum numbers (Decision 2).
      taskTypes.push(toOnChainTaskType(task.type as TaskType))
      descriptions.push(task.description)
      verificationDatas.push(
        ethers.encodeBytes32String(task.verificationData || ''),
      )
      isOptionals.push(false)
    }

    // Prepare reward values
    let rewardType
    let tokenAddress = ethers.ZeroAddress
    let rewardAmount: string | bigint = '0'

    switch (campaignData.reward.type) {
      case 'ERC20':
        rewardType = 0
        tokenAddress = campaignData.reward.tokenAddress
        rewardAmount = ethers.parseUnits(campaignData.reward.amount || '0', 18)
        break
      case 'ERC721':
        rewardType = 1
        tokenAddress = campaignData.reward.tokenAddress
        rewardAmount = '0'
        break
      case 'None':
        rewardType = 2
        break
      default:
        throw new Error('Invalid reward type')
    }

    // 1. Create Campaign with tasks and reward in a single transaction
    const tx = await contractWithSigner.createCampaignWithTasksAndReward(
      campaignData.title,
      actualStartTime,
      actualEndTime,
      taskTypes,
      descriptions,
      verificationDatas,
      isOptionals,
      rewardType,
      tokenAddress,
      rewardAmount,
    )
    const receipt = await tx.wait()

    const event = receipt.logs
      .map((log: any) => {
        try {
          return contract?.interface.parseLog(log) || null
        } catch (e) {
          return null
        }
      })
      .find((e: any) => e && e.name === 'CampaignCreated')

    if (!event) throw new Error('CampaignCreated event not found')
    const campaignId = event.args.campaignId

    // 2. Add Off-Chain Task Metadata (DB only)
    console.log(
      '🔄 Processing off-chain task metadata in createAndActivateCampaign:',
      campaignData.tasks.length,
    )
    for (const task of campaignData.tasks) {
      console.log(
        '🔧 Processing task off-chain metadata in createAndActivateCampaign:',
        {
          type: task.type,
          verificationData: task.verificationData,
          telegramInviteLink: task.telegramInviteLink,
          discordInviteLink: task.discordInviteLink,
        },
      )

      // Store Discord invite links in database for this campaign
      if (task.type === 'JOIN_DISCORD' && task.discordInviteLink) {
        try {
          const taskIndex = campaignData.tasks.indexOf(task)
          console.log(
            '🎮 Storing Discord metadata for task in createAndActivateCampaign',
            taskIndex,
          )
          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignId: Number(campaignId),
              taskIndex: taskIndex,
              taskType: task.type,
              discordInviteLink: task.discordInviteLink,
              discordServerId: task.verificationData,
            }),
          })
          console.log(
            '✅ Discord metadata stored successfully in createAndActivateCampaign',
          )
        } catch (e) {
          console.warn('Failed to store Discord invite link in database:', e)
        }
      }

      // Store payment metadata in database for ONCHAIN_TX payment tasks
      if (task.type === 'ONCHAIN_TX' && task.paymentRequired) {
        try {
          const taskIndex = campaignData.tasks.indexOf(task)
          console.log(
            '💰 Storing payment metadata for task in createAndActivateCampaign',
            taskIndex,
          )
          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignId: Number(campaignId),
              taskIndex: taskIndex,
              taskType: task.type,
              metadata: {
                paymentRequired: true,
                paymentRecipient: task.paymentRecipient,
                chainId: task.chainId,
                network: task.network,
                tokenAddress: task.tokenAddress || null,
                tokenSymbol: task.tokenSymbol,
                amount: task.amount,
                amountDisplay: task.amountDisplay,
              },
            }),
          })
          console.log(
            '✅ Payment metadata stored successfully in createAndActivateCampaign',
          )
        } catch (e) {
          console.warn('Failed to store payment metadata in database:', e)
        }
      }

      if (
        task.type === 'JOIN_TELEGRAM' &&
        (task.verificationData || task.telegramInviteLink)
      ) {
        try {
          const taskIndex = campaignData.tasks.indexOf(task)
          console.log(
            '📱 Storing Telegram metadata for task in createAndActivateCampaign',
            taskIndex,
          )

          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignId: Number(campaignId),
              taskIndex: taskIndex,
              taskType: task.type,
              telegramChatId: task.verificationData, // Form stores chat ID in verificationData
              telegramInviteLink: task.telegramInviteLink,
            }),
          })

          console.log(
            '📤 Sending Telegram metadata request in createAndActivateCampaign:',
          )
        } catch (e) {
          console.warn(
            '❌ Failed to store Telegram metadata in database in createAndActivateCampaign:',
            e,
          )
        }
      } else if (task.type === 'JOIN_TELEGRAM') {
        console.log(
          '⚠️ Telegram task found but missing data in createAndActivateCampaign:',
          {
            verificationData: task.verificationData,
            telegramInviteLink: task.telegramInviteLink,
          },
        )
      }

      // Store humanity preset in database for HUMANITY_VERIFICATION tasks
      if (task.type === 'HUMANITY_VERIFICATION') {
        try {
          const taskIndex = campaignData.tasks.indexOf(task)
          const rawPreset = (task as any).humanityPreset
          const presetToStore =
            Array.isArray(rawPreset) && rawPreset.length > 0
              ? rawPreset
              : [rawPreset ?? 'is_human']
          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // Convert BigInt to Number so JSON.stringify doesn't throw
              campaignId: Number(campaignId),
              taskIndex: taskIndex,
              taskType: task.type,
              metadata: {
                humanityPreset: presetToStore,
              },
            }),
          })
          console.log(
            `✅ Humanity presets ${JSON.stringify(presetToStore)} stored for task index ${taskIndex} (campaign ${Number(campaignId)})`,
          )
        } catch (e) {
          console.warn('Failed to store humanity preset in database:', e)
        }
      }
    }

    // 4. If the start time is in the future, the campaign will be in Draft status and can be opened later
    // If the start time is now or very soon, it should automatically become Active

    // Save image URL and campaign metadata to database
    {
      console.log('💾 Saving campaign metadata to database...')
      try {
        // Sign authentication message
        const address = await signer.getAddress()
        const nonce = Date.now().toString()
        const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
        const signature = await signer.signMessage(message)

        // Determine reward name for storage
        let rewardNameToStore = ''
        if (campaignData.reward.type === 'None') {
          rewardNameToStore =
            campaignData.reward.name || 'A special off-chain reward'
        } else if (campaignData.reward.type === 'ERC20') {
          rewardNameToStore =
            campaignData.reward.name ||
            `${campaignData.reward.amount} ERC20 Tokens`
        } else if (campaignData.reward.type === 'ERC721') {
          rewardNameToStore = campaignData.reward.name || 'NFT Reward'
        }

        const imageResponse = await fetch(
          `/api/campaigns/${campaignId}/image`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: campaignData.imageUrl || 'https://placehold.co/600x400',
              signature,
              message,
              shortDescription: campaignData.shortDescription || '',
              longDescription: campaignData.description || '',
              rewardType: campaignData.reward.type,
              rewardName: rewardNameToStore,
            }),
          },
        )

        if (imageResponse.ok) {
          console.log('✅ Campaign metadata saved to database')
        } else {
          console.warn(
            '⚠️ Failed to save campaign metadata, but campaign created successfully',
          )
        }
      } catch (metadataError) {
        console.warn('⚠️ Error saving campaign metadata:', metadataError)
        // Don't fail campaign creation if metadata save fails
      }
    }

    const statusMessage =
      actualStartTime <= now + 60
        ? 'Your campaign has been created and is now active!'
        : `Your campaign has been created and will become active on ${new Date(
            actualStartTime * 1000,
          ).toLocaleString()}.`

    toast({
      title: 'Success!',
      description: statusMessage,
    })

    return campaignId
  } catch (error: any) {
    console.error('Error creating campaign:', error)
    const reason = error.reason || error.message
    let description = `Transaction failed: ${reason}`

    if (error.code === 'CALL_EXCEPTION' && !reason) {
      description =
        'Transaction failed. This may be due to an invalid campaign duration, or another contract requirement was not met.'
    } else if (reason?.includes('Campaign not in active period')) {
      description = `The campaign is not in an active period for this action.`
    }

    toast({ variant: 'destructive', title: 'Transaction Failed', description })
    throw error
  }
}

export const createCampaign = async (campaignData: any) => {
  console.log('🚀 === createCampaign FUNCTION CALLED ===')
  console.log(
    '📋 Campaign data received:',
    JSON.stringify(campaignData, null, 2),
  )

  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract

  // ── QUARANTINED (v0.6.0) ──────────────────────────────────────────────────────────
  // TODO(P1): same as createAndActivateCampaign — `createCampaignWithTasksAndReward` is
  // gone in v0.6.0. Rebuild as the multi-step Draft flow (createCampaign → batchAddTasks →
  // configureERC20Reward + fundCampaignERC20 / deposits / tiered module → keep in Draft).
  // See docs/GAP_ANALYSIS_v0.6.0.md §2.4 and PRD FR-H2..H6. Legacy body below is
  // intentionally unreachable and kept only for reference.
  throw new Error(
    'Campaign creation is being rebuilt for the v0.6.0 escrow/settlement contracts (P1). ' +
      'The single-transaction create+reward path no longer exists on-chain.',
  )

  // Use the actual dates provided by the user
  const userStartTime = Math.floor(campaignData.dates.from.getTime() / 1000)
  const userEndTime = Math.floor(campaignData.dates.to.getTime() / 1000)

  // Check if localStorage is available (not server-side)
  const hasLocalStorage = typeof window !== 'undefined' && window.localStorage

  try {
    // Prepare task arrays for unified call
    const taskTypes: number[] = []
    const descriptions: string[] = []
    const verificationDatas: string[] = []
    const isOptionals: boolean[] = []

    for (const task of campaignData.tasks) {
      // Route through the canonical taxonomy — never hardcode enum numbers (Decision 2).
      taskTypes.push(toOnChainTaskType(task.type as TaskType))
      descriptions.push(task.description)
      verificationDatas.push(
        ethers.encodeBytes32String(task.verificationData || ''),
      )
      isOptionals.push(false)
    }

    // Prepare reward values
    let rewardType
    let tokenAddress = ethers.ZeroAddress
    let rewardAmount: string | bigint = '0'

    switch (campaignData.reward.type) {
      case 'ERC20':
        rewardType = 0
        tokenAddress = campaignData.reward.tokenAddress
        rewardAmount = ethers.parseUnits(campaignData.reward.amount || '0', 18)
        break
      case 'ERC721':
        rewardType = 1
        tokenAddress = campaignData.reward.tokenAddress
        rewardAmount = '0'
        break
      case 'None':
        rewardType = 2
        break
      default:
        throw new Error('Invalid reward type')
    }

    // 1. Create Campaign with tasks and reward in a single transaction
    const tx = await contractWithSigner.createCampaignWithTasksAndReward(
      campaignData.title,
      userStartTime,
      userEndTime,
      taskTypes,
      descriptions,
      verificationDatas,
      isOptionals,
      rewardType,
      tokenAddress,
      rewardAmount,
    )
    const receipt = await tx.wait()

    const event = receipt.logs
      .map((log: any) => {
        try {
          return contractWithSigner.interface.parseLog(log)
        } catch (e) {
          return null
        }
      })
      .find((e: any) => e && e.name === 'CampaignCreated')

    if (!event) throw new Error('CampaignCreated event not found')
    const campaignId = event.args.campaignId

    // 2. Add Off-Chain Task Metadata (DB only)
    console.log(
      '🔄 Processing off-chain task metadata:',
      campaignData.tasks.length,
    )
    for (const task of campaignData.tasks) {
      console.log('🔧 Processing task off-chain metadata:', {
        type: task.type,
        verificationData: task.verificationData,
        telegramInviteLink: task.telegramInviteLink,
        discordInviteLink: task.discordInviteLink,
      })

      // Store Discord invite links in database for this campaign
      if (task.type === 'JOIN_DISCORD' && task.discordInviteLink) {
        try {
          const taskIndex = campaignData.tasks.indexOf(task)
          console.log('🎮 Storing Discord metadata for task', taskIndex)
          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignId: Number(campaignId),
              taskIndex: taskIndex,
              taskType: task.type,
              discordInviteLink: task.discordInviteLink,
              discordServerId: task.verificationData,
            }),
          })
          console.log('✅ Discord metadata stored successfully')
        } catch (e) {
          console.warn('Failed to store Discord invite link in database:', e)
        }
      }

      // Store payment metadata in database for ONCHAIN_TX payment tasks
      if (task.type === 'ONCHAIN_TX' && task.paymentRequired) {
        try {
          const taskIndex = campaignData.tasks.indexOf(task)
          console.log('💰 Storing payment metadata for task', taskIndex)
          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignId: Number(campaignId),
              taskIndex: taskIndex,
              taskType: task.type,
              metadata: {
                paymentRequired: true,
                paymentRecipient: task.paymentRecipient,
                chainId: task.chainId,
                network: task.network,
                tokenAddress: task.tokenAddress || null,
                tokenSymbol: task.tokenSymbol,
                amount: task.amount,
                amountDisplay: task.amountDisplay,
              },
            }),
          })
          console.log('✅ Payment metadata stored successfully')
        } catch (e) {
          console.warn('Failed to store payment metadata in database:', e)
        }
      }

      // Store Telegram metadata in database for this campaign
      console.log(
        '🔍 Checking Telegram task conditions for task type:',
        task.type,
      )
      console.log(
        '🔍 Task type strict equality check:',
        task.type === 'JOIN_TELEGRAM',
      )
      console.log('🔍 Verification data exists:', !!task.verificationData)
      console.log('🔍 Telegram invite link exists:', !!task.telegramInviteLink)
      console.log(
        '🔍 Combined condition result:',
        task.type === 'JOIN_TELEGRAM' &&
          (task.verificationData || task.telegramInviteLink),
      )

      if (
        task.type === 'JOIN_TELEGRAM' &&
        (task.verificationData || task.telegramInviteLink)
      ) {
        try {
          const taskIndex = campaignData.tasks.indexOf(task)
          console.log('📱 Storing Telegram metadata for task', taskIndex, {
            verificationData: task.verificationData,
            telegramInviteLink: task.telegramInviteLink,
          })

          const requestBody = {
            campaignId: Number(campaignId),
            taskIndex: taskIndex,
            taskType: task.type,
            telegramChatId: task.verificationData, // Form stores chat ID in verificationData
            telegramInviteLink: task.telegramInviteLink,
          }

          console.log('📤 Sending Telegram metadata request:', requestBody)
          console.log(
            '🌐 Current environment:',
            typeof window !== 'undefined' ? 'browser' : 'server',
          )
          console.log(
            '🌐 Base URL will be:',
            typeof window !== 'undefined' ? window.location.origin : 'relative',
          )

          const apiUrl =
            typeof window !== 'undefined'
              ? `${window.location.origin}/api/campaign-task-metadata`
              : '/api/campaign-task-metadata'

          console.log('🌐 Using API URL:', apiUrl)

          let response
          try {
            response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            })
            console.log('📡 Fetch completed, status:', response.status)
          } catch (fetchError) {
            console.error('❌ Fetch failed in createCampaign:', fetchError)
            throw fetchError
          }

          console.log(
            '📥 Telegram metadata API response status:',
            response.status,
          )
          const responseData = await response.json()
          console.log('📥 Telegram metadata API response data:', responseData)

          if (response.ok) {
            console.log('✅ Stored Telegram metadata for task', taskIndex)
          } else {
            console.error(
              '❌ Failed to store Telegram metadata - API error:',
              responseData,
            )
          }
        } catch (e) {
          console.warn('❌ Failed to store Telegram metadata in database:', e)
        }
      } else if (task.type === 'JOIN_TELEGRAM') {
        console.log('⚠️ Telegram task found but missing data:', {
          verificationData: task.verificationData,
          telegramInviteLink: task.telegramInviteLink,
        })
      }

      // Store humanity preset in database for HUMANITY_VERIFICATION tasks
      if (task.type === 'HUMANITY_VERIFICATION') {
        try {
          const taskIndex = campaignData.tasks.indexOf(task)
          const rawPreset = (task as any).humanityPreset
          const presetToStore =
            Array.isArray(rawPreset) && rawPreset.length > 0
              ? rawPreset
              : [rawPreset ?? 'is_human']
          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // Convert BigInt to Number so JSON.stringify doesn't throw
              campaignId: Number(campaignId),
              taskIndex: taskIndex,
              taskType: task.type,
              metadata: {
                humanityPreset: presetToStore,
              },
            }),
          })
          console.log(
            `✅ Humanity presets ${JSON.stringify(presetToStore)} stored for task index ${taskIndex} (campaign ${Number(campaignId)})`,
          )
        } catch (e) {
          console.warn('Failed to store humanity preset in database:', e)
        }
      }
    }

    console.log('🎯 Campaign creation successful! Campaign ID:', campaignId)

    // Save image URL and campaign metadata to database
    {
      console.log('💾 Saving campaign metadata to database...')
      try {
        // Sign authentication message
        const address = await signer.getAddress()
        const nonce = Date.now().toString()
        const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
        const signature = await signer.signMessage(message)

        // Determine reward name for storage
        let rewardNameToStore = ''
        if (campaignData.reward.type === 'None') {
          rewardNameToStore =
            campaignData.reward.name || 'A special off-chain reward'
        } else if (campaignData.reward.type === 'ERC20') {
          rewardNameToStore =
            campaignData.reward.name ||
            `${campaignData.reward.amount} ERC20 Tokens`
        } else if (campaignData.reward.type === 'ERC721') {
          rewardNameToStore = campaignData.reward.name || 'NFT Reward'
        }

        const imageResponse = await fetch(
          `/api/campaigns/${campaignId}/image`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: campaignData.imageUrl || 'https://placehold.co/600x400',
              signature,
              message,
              shortDescription: campaignData.shortDescription || '',
              longDescription: campaignData.description || '',
              rewardType: campaignData.reward.type,
              rewardName: rewardNameToStore,
            }),
          },
        )

        if (imageResponse.ok) {
          console.log('✅ Campaign metadata saved to database')
        } else {
          console.warn(
            '⚠️ Failed to save campaign metadata, but campaign created successfully',
          )
        }
      } catch (metadataError) {
        console.warn('⚠️ Error saving campaign metadata:', metadataError)
        // Don't fail campaign creation if metadata save fails
      }
    }

    toast({
      title: 'Success!',
      description:
        'Your campaign has been created successfully with your specified dates!',
    })
    return campaignId
  } catch (error: any) {
    console.error('Error creating campaign:', error)
    const reason = error.reason || error.message
    let description = `Transaction failed: ${reason}`

    if (error.code === 'CALL_EXCEPTION' && !reason) {
      description =
        'Transaction failed. This may be due to an invalid campaign duration, or another contract requirement was not met.'
    } else if (reason?.includes('Campaign not in active period')) {
      description = `The campaign is not in an active period for this action.`
    }

    toast({ variant: 'destructive', title: 'Transaction Failed', description })
    throw error
  }
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
      title: 'Success!',
      description: `You have been granted the HOST_ROLE.`,
    })
  } catch (error: any) {
    console.error('Error granting host role:', error)
    const reason = error.reason || 'An unknown error occurred.'
    toast({
      variant: 'destructive',
      title: 'Transaction Failed',
      description: `Failed to get host role. Reason: ${reason}`,
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

      // Handle specific smart contract errors
      let errorMessage = 'Could not open this campaign.'

      if (openError.reason) {
        if (
          openError.reason.includes(
            'Web3Campaigns__CampaignStartTimeNotYetStrated',
          )
        ) {
          errorMessage = 'Campaign start time has not been reached yet.'
        } else if (
          openError.reason.includes('Web3Campaigns__CampaignAlreadyStarted')
        ) {
          errorMessage = 'Campaign has already been started.'
        } else if (
          openError.reason.includes('Web3Campaigns__CallerIsNotHost')
        ) {
          errorMessage = 'Only the campaign host can open this campaign.'
        } else {
          errorMessage = `Contract error: ${openError.reason}`
        }
      } else if (openError.code === 'CALL_EXCEPTION') {
        errorMessage =
          'Smart contract rejected the transaction. Please check the campaign status and your permissions.'
      }

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
    const reason = error.reason || 'An unknown error occurred.'
    toast({
      variant: 'destructive',
      title: 'Transaction Failed',
      description: `Failed to end campaign. Reason: ${reason}`,
    })
    throw error
  }
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

    // Read the on-chain task type. In v0.6.0, completeTask self-verifies ONLY the two
    // hold types (ONCHAIN_HOLD_ERC20 = 8, ONCHAIN_HOLD_ERC721 = 9); their in-tx balance
    // check can make estimateGas fail with "missing revert data" when the RPC doesn't
    // return custom error data, so those get the manual-gas-limit path below.
    //
    // TODO(P1): every OTHER task type (social, discord/telegram, humanity, onchain_tx) is
    // an ATTESTED task in v0.6.0 — completeTask will revert TaskManagedBySignature for any
    // index an attestation has touched. They must settle via the backend SIGNER_ROLE service
    // (verifyTaskCompletionWithSignature), NOT this client call. See docs/GAP_ANALYSIS §3,
    // docs/DECISIONS_v0.6.0.md Decision 2, PRD FR-T1/FR-T3/BR-V*. This function should narrow
    // to self-verify hold tasks once the signer service lands.
    let taskTypeOnChain: number | null = null
    try {
      const taskData = await contractToRead.getCampaignTask(
        campaignIdNumber,
        taskIndex,
      )
      taskTypeOnChain = Number(taskData.taskType)
      console.log('On-chain task type:', taskTypeOnChain)
    } catch (e) {
      console.warn('Could not read task type, proceeding with default flow')
    }

    // Hold tasks (8/9) may revert during estimateGas without decodable data; handle via:
    // 1. staticCall to detect a real revert reason
    // 2. on success, send with default gas estimation
    // 3. on "missing revert data", send with a manual gas limit
    const isOnChainVerifiedTask =
      taskTypeOnChain === OnChainTaskType.ONCHAIN_HOLD_ERC20 ||
      taskTypeOnChain === OnChainTaskType.ONCHAIN_HOLD_ERC721

    let tx
    if (isOnChainVerifiedTask) {
      // For on-chain verified tasks, try staticCall first to detect revert reasons
      try {
        await contractWithSigner.completeTask.staticCall(
          campaignIdNumber,
          taskIndex,
        )
        // staticCall succeeded — the actual tx should also succeed
        tx = await contractWithSigner.completeTask(
          campaignIdNumber,
          taskIndex,
        )
      } catch (staticErr: any) {
        console.warn('staticCall failed for on-chain task:', staticErr?.shortMessage || staticErr?.message)

        // If "missing revert data" — the RPC just can't return the error.
        // Try sending the tx with a manual gas limit (bypasses estimateGas).
        if (
          staticErr?.shortMessage?.includes('missing revert data') ||
          staticErr?.message?.includes('missing revert data') ||
          (staticErr?.code === 'CALL_EXCEPTION' && staticErr?.data === null)
        ) {
          console.log('Attempting tx with manual gas limit to bypass estimateGas...')
          try {
            tx = await contractWithSigner.completeTask(
              campaignIdNumber,
              taskIndex,
              { gasLimit: 300000 },
            )
          } catch (manualGasErr: any) {
            console.error('Manual gas tx also failed:', manualGasErr?.shortMessage || manualGasErr?.message)
            throw manualGasErr
          }
        } else {
          // staticCall gave us a real error — re-throw it
          throw staticErr
        }
      }
    } else {
      tx = await contractWithSigner.completeTask(
        campaignIdNumber,
        taskIndex,
      )
    }

    console.log('Transaction sent:', tx.hash)
    await tx.wait()

    console.log('Task completed successfully!')
  } catch (error: any) {
    console.error('🔴 completeTask error object:', {
      code: error?.code,
      reason: error?.reason,
      message: error?.message,
      data: error?.data,
      errorData: error?.error?.data,
      infoErrorData: error?.info?.error?.data,
      shortMessage: error?.shortMessage,
      revert: error?.revert,
      transaction: error?.transaction,
    })

    if (error?.code === 'BAD_DATA' || error?.code === 'CALL_EXCEPTION') {
      console.warn(
        `Campaign ${campaignId} not found or reverted when attempting task completion.`,
      )
    } else {
      console.warn(
        `Error completing task ${taskIndex} for campaign ${campaignId}:`,
        error?.message || 'Unknown error',
      )
    }

    let description = `Failed to complete task.`

    const errorMap: Record<string, string> = {
      Web3Campaigns__CampaignNotOpen:
        'Campaign is not open for task completion.',
      Web3Campaigns__CampaignEnded:
        'This campaign has ended and cannot accept tasks.',
      Web3Campaigns__CampaignNotFound: 'Campaign not found.',
      Web3Campaigns__CampaignStartTimeNotYetStrated:
        'Campaign start time has not been reached yet.',
      Web3Campaigns__TaskAlreadyCompleted:
        'You have already completed this task.',
      Web3Campaigns__TaskNotFound: 'Task not found in this campaign.',
      Web3Campaigns__PosterCannotAcceptOwnTask:
        'Campaign hosts cannot complete tasks on their own campaign.',
      Web3Campaigns__TaskNotVerifiableByHost:
        'This task requires host verification before completion.',
      EnforcedPause:
        'The contract is currently paused. Please try again later.',
      ReentrancyGuardReentrantCall:
        'Transaction was blocked due to reentrancy protection. Please try again.',
    }

    // Try to decode custom errors for a clearer message — check ALL possible data locations
    const errorDataCandidates = [
      error?.data?.data,
      error?.data,
      error?.error?.data,
      error?.info?.error?.data,
      error?.error?.error?.data,
      error?.info?.error?.error?.data,
      // ethers.js v6 sometimes puts it under revert
      error?.revert?.data,
    ].filter(
      (d) => d && typeof d === 'string' && d.startsWith('0x') && d.length > 2,
    )

    console.log('🔍 Error data candidates found:', errorDataCandidates)

    let decoded = null
    const iface = new ethers.Interface(Web3Campaigns.abi)

    for (const errorData of errorDataCandidates) {
      try {
        decoded = iface.parseError(errorData)
        if (decoded?.name) {
          console.log('✅ Decoded custom error:', decoded.name)
          description =
            errorMap[decoded.name] || `Contract error: ${decoded.name}`
          break
        }
      } catch (decodeError) {
        console.warn(
          'Failed to decode error data candidate:',
          errorData,
          decodeError,
        )
      }
    }

    // If we couldn't decode from error data, try to simulate the call to get the revert data
    if (!decoded && contractWithSigner) {
      try {
        console.log('🔍 Attempting eth_call simulation to get revert data...')
        const campaignIdNumber = parseInt(campaignId, 10)
        await contractWithSigner.completeTask.staticCall(
          campaignIdNumber,
          taskIndex,
        )
      } catch (simError: any) {
        console.log('🔍 Simulation error:', {
          code: simError?.code,
          reason: simError?.reason,
          data: simError?.data,
          revert: simError?.revert,
          shortMessage: simError?.shortMessage,
        })

        // Try to extract error name from simulation
        const simDataCandidates = [
          simError?.data?.data,
          simError?.data,
          simError?.error?.data,
          simError?.info?.error?.data,
          simError?.revert?.data,
        ].filter(
          (d) =>
            d && typeof d === 'string' && d.startsWith('0x') && d.length > 2,
        )

        for (const simData of simDataCandidates) {
          try {
            decoded = iface.parseError(simData)
            if (decoded?.name) {
              console.log(
                '✅ Decoded custom error from simulation:',
                decoded.name,
              )
              description =
                errorMap[decoded.name] || `Contract error: ${decoded.name}`
              break
            }
          } catch {
            // continue to next candidate
          }
        }

        // Also check if the simulation gave us a reason string
        if (!decoded && simError?.reason) {
          console.log('✅ Got reason from simulation:', simError.reason)
          // Check against known error names
          for (const [errorName, errorMsg] of Object.entries(errorMap)) {
            if (simError.reason.includes(errorName)) {
              description = errorMsg
              decoded = { name: errorName } as any
              break
            }
          }
        }

        // Check shortMessage from simulation
        if (!decoded && simError?.shortMessage) {
          for (const [errorName, errorMsg] of Object.entries(errorMap)) {
            if (simError.shortMessage.includes(errorName)) {
              description = errorMsg
              decoded = { name: errorName } as any
              break
            }
          }
        }
      }
    }

    // Parse common smart contract errors from error.reason
    if (!decoded && error.reason) {
      if (error.reason.includes('CampaignNotOpen')) {
        description = 'Campaign is not open for task completion.'
      } else if (error.reason.includes('TaskAlreadyCompleted')) {
        description = 'You have already completed this task.'
      } else if (error.reason.includes('TaskNotFound')) {
        description = 'Task not found in this campaign.'
      } else if (error.reason.includes('PosterCannotAcceptOwnTask')) {
        description =
          'Campaign hosts cannot complete tasks on their own campaign.'
      } else if (error.reason.includes('Too many rapid actions')) {
        description = 'Please wait 30 seconds between actions.'
      } else if (
        error.reason.includes('Account flagged for suspicious activity')
      ) {
        description = 'Account flagged for suspicious activity.'
      } else if (error.reason.includes('Campaign not in active period')) {
        description = 'This campaign is not currently active.'
      } else {
        description += ` Reason: ${error.reason}`
      }
    } else if (!decoded && error.shortMessage) {
      // ethers.js v6 often puts useful info in shortMessage
      for (const [errorName, errorMsg] of Object.entries(errorMap)) {
        if (error.shortMessage.includes(errorName)) {
          description = errorMsg
          break
        }
      }
      if (description === 'Failed to complete task.') {
        description = error.shortMessage
      }
    } else if (
      !decoded &&
      error.message &&
      !error.message.includes('missing revert data') &&
      !error.message.includes('CALL_EXCEPTION')
    ) {
      // Use the message only if it's our own pre-check error, not the raw ethers CALL_EXCEPTION
      description = error.message
    } else if (!decoded) {
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
