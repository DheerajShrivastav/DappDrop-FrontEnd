import { ethers, BrowserProvider, Contract, Eip1193Provider } from 'ethers'
import { toast } from '@/hooks/use-toast'
import type { Campaign, ParticipantData, TaskType } from './types'
import config from '@/app/config'
import Web3Campaigns from './abi/Web3Campaigns.json'
import { addDays, endOfDay, differenceInSeconds } from 'date-fns'

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

const SEPOLIA_CHAIN_ID = '0xaa36a7' // Sepolia chain id in hex
const SEPOLIA_RPC_URL = 'https://ethereum-sepolia.publicnode.com'

const initializeReadOnlyProvider = () => {
  if (readOnlyContract) return
  try {
    const rpcProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL)
    if (config.campaignFactoryAddress) {
      readOnlyContract = new ethers.Contract(
        config.campaignFactoryAddress,
        Web3Campaigns.abi,
        rpcProvider
      )
    }
  } catch (e) {
    console.error('Failed to initialize read-only provider', e)
  }
}

const initializeProviderAndContract = (walletProvider?: Eip1193Provider) => {
  if (walletProvider) {
    provider = new ethers.BrowserProvider(walletProvider)
    if (config.campaignFactoryAddress) {
      contract = new ethers.Contract(
        config.campaignFactoryAddress,
        Web3Campaigns.abi,
        provider
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
  if (!provider || !window.ethereum) {
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

const mapContractDataToCampaign = (
  contractData: any,
  id: number,
  taskMetadata?: Array<{ taskIndex: number; discordInviteLink?: string }>,
  imageUrl?: string
): Campaign => {
  const statusMap = ['Draft', 'Open', 'Ended', 'Closed']
  const rewardTypeMap = ['ERC20', 'ERC721', 'None']
  const taskTypeMap: TaskType[] = [
    'SOCIAL_FOLLOW',
    'JOIN_DISCORD',
    'JOIN_TELEGRAM',
    'RETWEET',
    'HUMANITY_VERIFICATION',
    'ONCHAIN_TX',
  ]

  let rewardName = `Reward for ${contractData.name}`
  if (Number(contractData.reward.rewardType) === 2) {
    // "None" type
    rewardName = 'A special off-chain reward'
  }

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
    description: `A campaign hosted by ${contractData.host}`, // Short description placeholder
    longDescription: `A campaign hosted by ${contractData.host} with the name ${contractData.name}. More details can be found on the blockchain.`, // Long description placeholder
    startDate,
    endDate,
    status: statusMap[Number(contractData.status)] as
      | 'Draft'
      | 'Open'
      | 'Ended'
      | 'Closed',
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
            task.verificationData
          )
        } catch (e) {
          console.error('Failed to decode bytes32 string:', e)
        }
      }

      // For Discord tasks, try to load invite link from task metadata
      let discordInviteLink = ''
      if (taskTypeMap[Number(task.taskType)] === 'JOIN_DISCORD') {
        if (taskMetadata && Array.isArray(taskMetadata)) {
          const metadata = taskMetadata.find((tm) => tm.taskIndex === index)
          if (metadata && metadata.discordInviteLink) {
            discordInviteLink = metadata.discordInviteLink
            console.log(
              `Found Discord invite link for task ${index}:`,
              discordInviteLink
            )
          } else {
            console.warn(
              `No Discord invite link found for task ${index} in campaign ${id}`
            )
          }
        } else {
          console.warn(`No task metadata available for campaign ${id}`)
        }
      }

      return {
        id: index.toString(),
        type: taskTypeMap[Number(task.taskType)] as TaskType,
        description: task.description,
        verificationData: verificationDataString,
        discordInviteLink: discordInviteLink || undefined,
      }
    }),
    reward: {
      type: rewardTypeMap[Number(contractData.reward.rewardType)] as
        | 'ERC20'
        | 'ERC721'
        | 'None',
      tokenAddress: contractData.reward.tokenAddress,
      amount: contractData.reward.amountOrTokenId.toString(),
      name: rewardName,
    },
    imageUrl: imageUrl || `https://placehold.co/600x400`,
    'data-ai-hint': 'blockchain technology',
  }
}

const switchOrAddSepoliaNetwork = async (ethereum: Eip1193Provider) => {
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    })
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID,
              chainName: 'Sepolia Testnet',
              nativeCurrency: {
                name: 'Sepolia Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: [SEPOLIA_RPC_URL],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            },
          ],
        })
      } catch (addError) {
        console.error('Failed to add Sepolia network:', addError)
        toast({
          variant: 'destructive',
          title: 'Network Error',
          description: 'Failed to add Sepolia network to your wallet.',
        })
        throw addError
      }
    } else {
      console.error('Failed to switch to Sepolia network:', switchError)
      toast({
        variant: 'destructive',
        title: 'Network Error',
        description:
          'Please switch to the Sepolia test network in your wallet.',
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
      }
    )

    if (response.ok) {
      const result = await response.json()
      if (result.success && Array.isArray(result.data)) {
        console.log(
          `Fetched task metadata for campaign ${campaignId}:`,
          result.data
        )
        return result.data
      } else {
        console.warn(`No task metadata found for campaign ${campaignId}`)
      }
    } else {
      console.warn(
        `Failed to fetch task metadata for campaign ${campaignId}:`,
        response.status,
        response.statusText
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
    await switchOrAddSepoliaNetwork(selectedProvider)
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
    // If it was just initialized, use it
    return getAllCampaigns()
  }

  try {
    const campaignCountBigInt = await contractToUse.getCampaignCount()
    const campaignCount = Number(campaignCountBigInt)

    if (campaignCount === 0) return []

    const campaigns = []
    // Start from 1 as campaign IDs are 1-based index
    for (let i = 1; i <= campaignCount; i++) {
      try {
        const campaignData = await contractToUse.getCampaign(i)
        if (Number(campaignData.status) !== 3) {
          // Not 'Closed'

          // Fetch image URL from database if available
          let imageUrl: string | undefined
          if (typeof window !== 'undefined') {
            try {
              const imageResponse = await fetch(`/api/campaigns/${i}/image`)
              if (imageResponse.ok) {
                const imageData = await imageResponse.json()
                imageUrl = imageData.imageUrl
              }
            } catch (e) {
              // Silently fail if image fetch fails
            }
          }

          const campaign = mapContractDataToCampaign(
            campaignData,
            i,
            undefined,
            imageUrl
          )

          campaigns.push(campaign)
        }
      } catch (error) {
        console.error(`Failed to fetch campaign ${i}:`, error)
      }
    }
    // Show open and ended campaigns, but not drafts
    return campaigns.filter((c) => c.status === 'Open' || c.status === 'Ended')
  } catch (error: any) {
    if (error.code === 'CALL_EXCEPTION') {
      console.error(
        'Contract call failed. Check contract address and network.',
        error
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
  hostAddress: string
): Promise<Campaign[]> => {
  const contractToUse = readOnlyContract ?? contract
  if (!contractToUse) {
    console.warn('Contract not initialized for getting host campaigns.')
    return []
  }

  try {
    const campaignIdsBigInt: bigint[] = await contractToUse.getCampaignsByHost(
      hostAddress
    )
    const campaignIds = campaignIdsBigInt.map((id) => Number(id))

    if (campaignIds.length === 0) return []

    const campaigns = await Promise.all(
      campaignIds.map(async (id) => {
        try {
          const campaignData = await contractToUse.getCampaign(id)

          // Fetch image URL from database if available
          let imageUrl: string | undefined
          if (typeof window !== 'undefined') {
            try {
              const imageResponse = await fetch(`/api/campaigns/${id}/image`)
              if (imageResponse.ok) {
                const imageData = await imageResponse.json()
                imageUrl = imageData.imageUrl
              }
            } catch (e) {
              // Silently fail if image fetch fails
            }
          }

          const campaign = mapContractDataToCampaign(
            campaignData,
            id,
            undefined,
            imageUrl
          )

          return campaign
        } catch (error) {
          console.error(
            `Failed to fetch campaign ${id} for host ${hostAddress}:`,
            error
          )
          return null
        }
      })
    )

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

    // Fetch image URL from database if available
    let imageUrl: string | undefined
    if (typeof window !== 'undefined') {
      try {
        const imageResponse = await fetch(`/api/campaigns/${id}/image`)
        if (imageResponse.ok) {
          const imageData = await imageResponse.json()
          imageUrl = imageData.imageUrl
        }
      } catch (e) {
        // Silently fail if image fetch fails
      }
    }

    const campaign = mapContractDataToCampaign(
      campaignData,
      parseInt(id),
      undefined,
      imageUrl
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
  } catch (error) {
    console.error(`Error fetching campaign ${id}:`, error)
    return null
  }
}

// Enhanced function to get campaign by ID with Discord invite links for client-side use
export const getCampaignByIdWithMetadata = async (
  id: string,
  forceRefresh: boolean = false
): Promise<Campaign | null> => {
  console.log(
    `getCampaignByIdWithMetadata called for campaign ${id}, forceRefresh: ${forceRefresh}`
  )

  // First get the basic campaign data
  const campaign = await getCampaignById(id)
  if (!campaign) return null

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
        // Update Discord tasks with invite links
        campaign.tasks = campaign.tasks.map((task, index) => {
          if (task.type === 'JOIN_DISCORD') {
            const metadata = taskMetadata.find((tm) => tm.taskIndex === index)
            if (metadata && metadata.discordInviteLink) {
              return {
                ...task,
                discordInviteLink: metadata.discordInviteLink,
              }
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
    JSON.stringify(campaignData, null, 2)
  )

  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract

  // Use the actual dates provided by the user, but ensure start time is not in the past
  const now = Math.floor(Date.now() / 1000)
  const userStartTime = Math.floor(campaignData.dates.from.getTime() / 1000)
  const userEndTime = Math.floor(campaignData.dates.to.getTime() / 1000)

  // If user's start time is in the past, set it to current time + 1 minute
  const actualStartTime = userStartTime < now ? now + 60 : userStartTime
  const actualEndTime = userEndTime

  // Check if localStorage is available (not server-side)
  const hasLocalStorage = typeof window !== 'undefined' && window.localStorage

  const taskTypeMap: Record<TaskType, number> = {
    SOCIAL_FOLLOW: 0,
    JOIN_DISCORD: 1,
    JOIN_TELEGRAM: 2,
    RETWEET: 3,
    HUMANITY_VERIFICATION: 4,
    ONCHAIN_TX: 4,
  }

  try {
    // 1. Create Campaign with actual dates
    const tx = await contractWithSigner.createCampaign(
      campaignData.title,
      actualStartTime,
      actualEndTime
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
    const campaignId = event.args.campaignId.toString()

    // 2. Add Tasks
    console.log(
      '🔄 Processing tasks in createAndActivateCampaign:',
      campaignData.tasks.length
    )
    for (const task of campaignData.tasks) {
      console.log('🔧 Processing task in createAndActivateCampaign:', {
        type: task.type,
        verificationData: task.verificationData,
        telegramInviteLink: task.telegramInviteLink,
        discordInviteLink: task.discordInviteLink,
      })

      const taskType = taskTypeMap[task.type as TaskType]

      // For blockchain storage, we only store the server ID (needed for verification)
      // The invite link will be stored separately in the database
      let verificationDataToStore = task.verificationData || ''

      const verificationDataBytes = ethers.encodeBytes32String(
        verificationDataToStore
      )

      const taskTx = await contractWithSigner.addTaskToCampaign(
        campaignId,
        taskType,
        task.description,
        verificationDataBytes,
        false
      )
      await taskTx.wait()

      // Store Discord invite links in database for this campaign
      if (task.type === 'JOIN_DISCORD' && task.discordInviteLink) {
        try {
          const taskIndex = campaignData.tasks.indexOf(task)
          console.log(
            '🎮 Storing Discord metadata for task in createAndActivateCampaign',
            taskIndex
          )
          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignId: campaignId,
              taskIndex: taskIndex,
              taskType: task.type,
              discordInviteLink: task.discordInviteLink,
            }),
          })
          console.log(
            '✅ Discord metadata stored successfully in createAndActivateCampaign'
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
            taskIndex
          )
          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignId: campaignId,
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
            '✅ Payment metadata stored successfully in createAndActivateCampaign'
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
            taskIndex
          )

          await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignId: campaignId,
              taskIndex: taskIndex,
              taskType: task.type,
              telegramChatId: task.verificationData, // Form stores chat ID in verificationData
              telegramInviteLink: task.telegramInviteLink,
            }),
          })

          console.log(
            '📤 Sending Telegram metadata request in createAndActivateCampaign:'
          )
        } catch (e) {
          console.warn(
            '❌ Failed to store Telegram metadata in database in createAndActivateCampaign:',
            e
          )
        }
      } else if (task.type === 'JOIN_TELEGRAM') {
        console.log(
          '⚠️ Telegram task found but missing data in createAndActivateCampaign:',
          {
            verificationData: task.verificationData,
            telegramInviteLink: task.telegramInviteLink,
          }
        )
      }
    }

    // 3. Set Reward
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

    if (rewardType !== 2) {
      const rewardTx = await contractWithSigner.setCampaignReward(
        campaignId,
        rewardType,
        tokenAddress,
        rewardAmount
      )
      await rewardTx.wait()
    }

    // 4. If the start time is in the future, the campaign will be in Draft status and can be opened later
    // If the start time is now or very soon, it should automatically become Active

    // Save image URL to database if provided
    if (
      campaignData.imageUrl &&
      campaignData.imageUrl !== 'https://placehold.co/600x400'
    ) {
      console.log('💾 Saving image URL to database...')
      try {
        // Sign authentication message
        const address = await signer.getAddress()
        const nonce = Date.now().toString()
        const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
        const signature = await signer.signMessage(message)

        const imageResponse = await fetch(
          `/api/campaigns/${campaignId}/image`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: campaignData.imageUrl,
              signature,
              message,
            }),
          }
        )

        if (imageResponse.ok) {
          console.log('✅ Image URL saved to database')
        } else {
          console.warn(
            '⚠️ Failed to save image URL, but campaign created successfully'
          )
        }
      } catch (imageError) {
        console.warn('⚠️ Error saving image URL:', imageError)
        // Don't fail campaign creation if image save fails
      }
    }

    const statusMessage =
      actualStartTime <= now + 60
        ? 'Your campaign has been created and is now active!'
        : `Your campaign has been created and will become active on ${new Date(
            actualStartTime * 1000
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
    JSON.stringify(campaignData, null, 2)
  )

  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract

  // Use the actual dates provided by the user
  const userStartTime = Math.floor(campaignData.dates.from.getTime() / 1000)
  const userEndTime = Math.floor(campaignData.dates.to.getTime() / 1000)

  // Check if localStorage is available (not server-side)
  const hasLocalStorage = typeof window !== 'undefined' && window.localStorage

  const taskTypeMap: Record<TaskType, number> = {
    SOCIAL_FOLLOW: 0,
    JOIN_DISCORD: 1,
    JOIN_TELEGRAM: 2,
    RETWEET: 3,
    HUMANITY_VERIFICATION: 4,
    ONCHAIN_TX: 4,
  }

  try {
    // 1. Create Campaign with user's actual dates
    const tx = await contractWithSigner.createCampaign(
      campaignData.title,
      userStartTime,
      userEndTime
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
    const campaignId = event.args.campaignId.toString()

    // 2. Add Tasks
    console.log('🔄 Processing tasks:', campaignData.tasks.length)
    for (const task of campaignData.tasks) {
      console.log('🔧 Processing task:', {
        type: task.type,
        verificationData: task.verificationData,
        telegramInviteLink: task.telegramInviteLink,
        discordInviteLink: task.discordInviteLink,
      })

      const taskType = taskTypeMap[task.type as TaskType]

      // For blockchain storage, we only store the server ID (needed for verification)
      // The invite link will be stored separately in database
      let verificationDataToStore = task.verificationData || ''

      const verificationDataBytes = ethers.encodeBytes32String(
        verificationDataToStore
      )

      const taskTx = await contractWithSigner.addTaskToCampaign(
        campaignId,
        taskType,
        task.description,
        verificationDataBytes,
        false
      )
      await taskTx.wait()

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
              campaignId: campaignId,
              taskIndex: taskIndex,
              taskType: task.type,
              discordInviteLink: task.discordInviteLink,
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
              campaignId: campaignId,
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
        task.type
      )
      console.log(
        '🔍 Task type strict equality check:',
        task.type === 'JOIN_TELEGRAM'
      )
      console.log('🔍 Verification data exists:', !!task.verificationData)
      console.log('🔍 Telegram invite link exists:', !!task.telegramInviteLink)
      console.log(
        '🔍 Combined condition result:',
        task.type === 'JOIN_TELEGRAM' &&
          (task.verificationData || task.telegramInviteLink)
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
            campaignId: campaignId,
            taskIndex: taskIndex,
            taskType: task.type,
            telegramChatId: task.verificationData, // Form stores chat ID in verificationData
            telegramInviteLink: task.telegramInviteLink,
          }

          console.log('📤 Sending Telegram metadata request:', requestBody)
          console.log(
            '🌐 Current environment:',
            typeof window !== 'undefined' ? 'browser' : 'server'
          )
          console.log(
            '🌐 Base URL will be:',
            typeof window !== 'undefined' ? window.location.origin : 'relative'
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
            response.status
          )
          const responseData = await response.json()
          console.log('📥 Telegram metadata API response data:', responseData)

          if (response.ok) {
            console.log('✅ Stored Telegram metadata for task', taskIndex)
          } else {
            console.error(
              '❌ Failed to store Telegram metadata - API error:',
              responseData
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
    }

    // 3. Set Reward
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

    if (rewardType !== 2) {
      const rewardTx = await contractWithSigner.setCampaignReward(
        campaignId,
        rewardType,
        tokenAddress,
        rewardAmount
      )
      await rewardTx.wait()
    }

    console.log('🎯 Campaign creation successful! Campaign ID:', campaignId)

    // Save image URL to database if provided
    if (
      campaignData.imageUrl &&
      campaignData.imageUrl !== 'https://placehold.co/600x400'
    ) {
      console.log('💾 Saving image URL to database...')
      try {
        // Sign authentication message
        const address = await signer.getAddress()
        const nonce = Date.now().toString()
        const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
        const signature = await signer.signMessage(message)

        const imageResponse = await fetch(
          `/api/campaigns/${campaignId}/image`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: campaignData.imageUrl,
              signature,
              message,
            }),
          }
        )

        if (imageResponse.ok) {
          console.log('✅ Image URL saved to database')
        } else {
          console.warn(
            '⚠️ Failed to save image URL, but campaign created successfully'
          )
        }
      } catch (imageError) {
        console.warn('⚠️ Error saving image URL:', imageError)
        // Don't fail campaign creation if image save fails
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
  participantAddress: string
): Promise<boolean> => {
  const contractToUse = contract ?? readOnlyContract
  if (!contractToUse || !participantAddress) return false
  try {
    return await contractToUse.hasParticipated(campaignId, participantAddress)
  } catch (error) {
    console.error(
      `Error checking participation for ${participantAddress} in campaign ${campaignId}:`,
      error
    )
    // Don't show a toast for this, as it might be called frequently
    return false
  }
}

export const isHost = async (address: string): Promise<boolean> => {
  const contractToUse = readOnlyContract ?? contract
  if (!contractToUse || !address) return false
  try {
    const hostRole = await contractToUse.HOST_ROLE()
    return await contractToUse.hasRole(hostRole, address)
  } catch (error) {
    console.error('Error checking for host role:', error)
    return false
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
  toast: any
): Promise<string> => {
  if (!contract) throw new Error('Contract not initialized')
  const signer = await getSigner()
  const contractWithSigner = contract.connect(signer) as Contract

  try {
    console.log(`Opening campaign ${campaignId}...`)

    // Get the current campaign data to check its status and times
    const campaignData = await contractWithSigner.getCampaign(campaignId)

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
      const tx = await contractWithSigner.openCampaign(campaignId)
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
            'Web3Campaigns__CampaignStartTimeNotYetStrated'
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
    const tx = await contractWithSigner.endCampaign(campaignId)
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
  const contractWithSigner = contract.connect(signer) as Contract

  try {
    console.log('Attempting to complete task:', {
      campaignId,
      taskIndex,
      userAddress: await signer.getAddress(),
    })

    // First, let's check the campaign status and other details
    const campaignData = await contractWithSigner.getCampaign(campaignId)
    console.log('Campaign data before task completion:', {
      id: campaignData.id.toString(),
      status: campaignData.status.toString(),
      tasksLength: campaignData.tasks.length,
      requestedTaskIndex: taskIndex,
    })

    // Check if campaign is in Open status (should be 1)
    if (Number(campaignData.status) !== 1) {
      throw new Error(
        `Campaign is not open. Current status: ${campaignData.status} (should be 1 for Open)`
      )
    }

    // Check if task index is valid
    if (taskIndex >= campaignData.tasks.length) {
      throw new Error(
        `Invalid task index ${taskIndex}. Campaign has ${campaignData.tasks.length} tasks.`
      )
    }

    // The smart contract completeTask function only takes campaignId and taskIndex
    // It automatically uses msg.sender (the connected wallet) as the participant
    console.log('Calling smart contract completeTask...')
    const tx = await contractWithSigner.completeTask(campaignId, taskIndex)

    console.log('Transaction sent:', tx.hash)
    await tx.wait()

    console.log('Task completed successfully!')
  } catch (error: any) {
    console.error(
      `Error completing task ${taskIndex} for campaign ${campaignId}:`,
      error
    )

    let description = `Failed to complete task.`

    // Parse common smart contract errors
    if (error.reason) {
      if (error.reason.includes('CampaignNotOpen')) {
        description = 'Campaign is not open for task completion.'
      } else if (error.reason.includes('TaskAlreadyCompleted')) {
        description = 'You have already completed this task.'
      } else if (error.reason.includes('TaskNotFound')) {
        description = 'Task not found in this campaign.'
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
    } else if (error.message) {
      description += ` Error: ${error.message}`
    }

    console.error('Parsed error description:', description)
    throw new Error(description)
  }
}

// Function to check if a user has completed specific tasks in a campaign
export const getUserTaskCompletionStatus = async (
  campaignId: string,
  userAddress: string,
  tasks: any[]
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

    // Check if we have a provider
    let providerInstance: ethers.Provider | null = null

    if (
      contractToUse.provider &&
      typeof (contractToUse.provider as any).getBlockNumber === 'function'
    ) {
      providerInstance = contractToUse.provider as unknown as ethers.Provider
    }

    if (!providerInstance) {
      // Create a new provider if the contract doesn't have one
      providerInstance = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL)

      // Create a new contract instance with the provider
      contractToUse = new ethers.Contract(
        config.campaignFactoryAddress!,
        Web3Campaigns.abi,
        providerInstance
      )
    }

    const latestBlock = await providerInstance.getBlockNumber()
    const startBlock = Math.max(0, latestBlock - 49999) // Look back up to ~50k blocks

    console.log(`Querying events from block ${startBlock} to ${latestBlock}`)

    // Query ParticipantTaskCompleted events for this campaign and user
    const filter = contractToUse.filters.ParticipantTaskCompleted(
      campaignId,
      userAddress
    )

    const events = await contractToUse.queryFilter(
      filter,
      startBlock,
      latestBlock
    )

    console.log(
      `Found ${events.length} ParticipantTaskCompleted events for user ${userAddress} in campaign ${campaignId}`
    )

    // Mark tasks as completed based on events
    events.forEach((event: any) => {
      const taskIndex = event.args?.[2] // taskIndex is the 3rd argument (BigInt)
      const taskIndexNumber = Number(taskIndex) // Convert BigInt to number

      if (
        typeof taskIndexNumber === 'number' &&
        taskIndexNumber < tasks.length
      ) {
        const task = tasks[taskIndexNumber]
        if (task) {
          // task.id is the index as string, so we need to match correctly
          completionStatus[task.id] = true
          console.log(
            `Marked task ${task.id} (index ${taskIndexNumber}) as completed for user ${userAddress}`
          )
        }
      } else {
        console.warn(
          `Invalid task index ${taskIndexNumber} for campaign ${campaignId}`
        )
      }
    })

    console.log('Task completion status for user:', {
      userAddress,
      campaignId,
      completionStatus,
      eventsFound: events.length,
      taskIds: tasks.map((t) => t.id),
      eventDetails: events.map((e) => ({
        taskIndex: Number((e as any).args?.[2]),
        blockNumber: e.blockNumber,
        transactionHash: e.transactionHash,
      })),
    })

    return completionStatus
  } catch (error) {
    console.error('Error checking user task completion status:', error)
    console.error('Error details:', {
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
  campaignId: string
): Promise<string[]> => {
  console.log(
    'getCampaignParticipantAddresses called with campaignId:',
    campaignId
  )

  // Try to use the wallet contract first, then fallback to read-only
  let contractToUse = contract ?? readOnlyContract

  if (!contractToUse) {
    console.log(
      'No contract available, trying to initialize read-only contract...'
    )
    initializeReadOnlyProvider()
    contractToUse = readOnlyContract
  }

  if (!contractToUse) {
    console.log('Still no contract available after initialization')
    return []
  }

  try {
    // Check if we have a provider
    let providerInstance: ethers.Provider | null = null

    if (
      contractToUse.provider &&
      typeof (contractToUse.provider as any).getBlockNumber === 'function'
    ) {
      providerInstance = contractToUse.provider as unknown as ethers.Provider
    }

    if (!providerInstance) {
      console.log('No provider on contract, creating new JsonRpc provider...')
      // Create a new provider if the contract doesn't have one
      providerInstance = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL)

      // Create a new contract instance with the provider
      contractToUse = new ethers.Contract(
        config.campaignFactoryAddress!,
        Web3Campaigns.abi,
        providerInstance
      )
    }

    console.log('Using provider:', providerInstance.constructor.name)

    const latestBlock = await providerInstance.getBlockNumber()
    const startBlock = Math.max(0, latestBlock - 49999) // Look back up to ~50k blocks

    console.log('Querying events from block', startBlock, 'to', latestBlock)

    // Query ParticipantTaskCompleted events for this campaign
    const filter = contractToUse.filters.ParticipantTaskCompleted(campaignId)
    console.log('Filter created:', filter)

    const events = await contractToUse.queryFilter(
      filter,
      startBlock,
      latestBlock
    )

    console.log('Raw events found:', events.length, events)

    // Extract unique participant addresses
    const participantSet = new Set<string>()
    events.forEach((event: any, index) => {
      console.log(`Event ${index}:`, event.args)
      const participant = event.args?.[1] // participant address is the 2nd argument
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

    return participantAddresses
  } catch (error) {
    console.error('Error fetching participant addresses:', error)
    return []
  }
}

export const getCampaignParticipants = async (
  campaign: Campaign
): Promise<ParticipantData[]> => {
  // Try to use the wallet contract first, then fallback to read-only
  let contractToUse = contract ?? readOnlyContract

  if (!contractToUse) {
    initializeReadOnlyProvider()
    contractToUse = readOnlyContract
  }

  if (!contractToUse) return []

  try {
    // Check if we have a provider
    let providerInstance: ethers.Provider | null = null

    if (
      contractToUse.provider &&
      typeof (contractToUse.provider as any).getBlockNumber === 'function'
    ) {
      providerInstance = contractToUse.provider as unknown as ethers.Provider
    }

    if (!providerInstance) {
      // Create a new provider if the contract doesn't have one
      providerInstance = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL)

      // Create a new contract instance with the provider
      contractToUse = new ethers.Contract(
        config.campaignFactoryAddress!,
        Web3Campaigns.abi,
        providerInstance
      )
    }

    const latestBlock = await providerInstance.getBlockNumber()

    const maxRange = 50000
    const startBlock = Math.max(0, latestBlock - 49999)

    let events: any[] = []
    for (
      let fromBlock = startBlock;
      fromBlock <= latestBlock;
      fromBlock += maxRange
    ) {
      const toBlock = Math.min(fromBlock + maxRange - 1, latestBlock)
      const filter = contractToUse.filters.ParticipantTaskCompleted(campaign.id)
      const chunkEvents = await contractToUse.queryFilter(
        filter,
        fromBlock,
        toBlock
      )
      events.push(...chunkEvents)
    }

    const participantTaskCompletion = new Map<string, Set<string>>()
    for (const event of events) {
      const [_, participant, taskId] = event.args
      const taskIdStr = taskId.toString()
      if (!participantTaskCompletion.has(participant)) {
        participantTaskCompletion.set(participant, new Set<string>())
      }
      participantTaskCompletion.get(participant)!.add(taskIdStr)
    }

    const participantAddresses = Array.from(participantTaskCompletion.keys())
    const participantData = await Promise.all(
      participantAddresses.map(async (address) => {
        const hasClaimed = await contractToUse!.hasClaimedReward(
          campaign.id,
          address
        )
        const completedTasksCount =
          participantTaskCompletion.get(address)?.size || 0
        return {
          address,
          tasksCompleted: completedTasksCount,
          claimed: hasClaimed,
        }
      })
    )

    return participantData
  } catch (error) {
    console.error('Error fetching participants:', error)
    toast({
      variant: 'destructive',
      title: 'Error',
      description: 'Could not fetch participant data.',
    })
    return []
  }
}

export const isPaused = async (): Promise<boolean> => {
  const contractToUse = readOnlyContract
  if (!contractToUse) return false
  try {
    return await contractToUse.paused()
  } catch (error) {
    console.error('Error checking for paused state:', error)
    return false
  }
}
