

import { ethers, BrowserProvider, Contract, Eip1193Provider } from 'ethers';
import { toast } from '@/hooks/use-toast';
import type { Campaign, ParticipantData, TaskType } from './types';
import config from '@/app/config';
import Web3Campaigns from './abi/Web3Campaigns.json';
import { addDays, endOfDay, differenceInSeconds } from 'date-fns';

// Extend the Window interface to include ethereum
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
        isMetaMask?: boolean;
        request: (...args: any[]) => Promise<any>;
        providers?: (Eip1193Provider & {isMetaMask?: boolean})[];
    };
  }
}

// --- Ethers Setup ---
let provider: BrowserProvider | null = null;
let contract: Contract | null = null;
let readOnlyContract: Contract | null = null;


const SEPOLIA_CHAIN_ID = '0xaa36a7'; // Sepolia chain id in hex
const SEPOLIA_RPC_URL = 'https://ethereum-sepolia.publicnode.com';

const initializeReadOnlyProvider = () => {
    if (readOnlyContract) return;
    try {
        const rpcProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        if(config.campaignFactoryAddress) {
            readOnlyContract = new ethers.Contract(config.campaignFactoryAddress, Web3Campaigns.abi, rpcProvider);
        }
    } catch (e) {
        console.error("Failed to initialize read-only provider", e);
    }
}

const initializeProviderAndContract = (walletProvider?: Eip1193Provider) => {
    if (walletProvider) {
        provider = new ethers.BrowserProvider(walletProvider);
        if (config.campaignFactoryAddress) {
            contract = new ethers.Contract(config.campaignFactoryAddress, Web3Campaigns.abi, provider);
        } else {
            contract = null;
        }
    } else {
        initializeReadOnlyProvider();
    }
}
// Initial call for read-only access
initializeReadOnlyProvider();


// --- Helper Functions ---

const getSigner = async () => {
  if (!provider || !(window.ethereum)) {
    toast({ variant: 'destructive', title: 'Wallet not connected', description: 'Please connect your wallet.' });
    throw new Error('Wallet not connected');
  }
  const signer = await provider.getSigner();
  return signer;
};


const mapContractDataToCampaign = (contractData: any, id: number): Campaign => {
    const statusMap = ['Draft', 'Active', 'Ended', 'Closed'];
    const rewardTypeMap = ['ERC20', 'ERC721', 'None'];
    const taskTypeMap: TaskType[] = ['SOCIAL_FOLLOW', 'JOIN_DISCORD', 'RETWEET', 'ONCHAIN_TX'];

    let rewardName = `Reward for ${contractData.name}`;
    if (Number(contractData.reward.rewardType) === 2) { // "None" type
        rewardName = "A special off-chain reward";
    }


    return {
        id: id.toString(),
        title: contractData.name,
        description: `A campaign hosted by ${contractData.host}`, // Short description placeholder
        longDescription: `A campaign hosted by ${contractData.host} with the name ${contractData.name}. More details can be found on the blockchain.`, // Long description placeholder
        startDate: new Date(Number(contractData.startTime) * 1000),
        endDate: new Date(Number(contractData.endTime) * 1000),
        status: statusMap[Number(contractData.status)] as 'Draft' | 'Active' | 'Ended' | 'Closed',
        participants: Number(contractData.totalParticipants),
        host: contractData.host,
        tasks: contractData.tasks.map((task: any, index: number) => {
            let verificationDataString = "";
            if (task.verificationData && ethers.isBytesLike(task.verificationData) && task.verificationData.length === 66) {
                try {
                    verificationDataString = ethers.decodeBytes32String(task.verificationData);
                } catch(e) {
                    console.error("Failed to decode bytes32 string:", e);
                }
            }

            return {
                id: index.toString(),
                type: taskTypeMap[Number(task.taskType)] as TaskType,
                description: task.description,
                verificationData: verificationDataString,
            }
        }),
        reward: {
            type: rewardTypeMap[Number(contractData.reward.rewardType)] as 'ERC20' | 'ERC721' | 'None',
            tokenAddress: contractData.reward.tokenAddress,
            amount: contractData.reward.amountOrTokenId.toString(),
            name: rewardName,
        },
        imageUrl: `https://placehold.co/600x400`,
        'data-ai-hint': 'blockchain technology',
    };
};


const switchOrAddSepoliaNetwork = async (ethereum: Eip1193Provider) => {
    try {
        await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
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
                });
            } catch (addError) {
                console.error('Failed to add Sepolia network:', addError);
                toast({ variant: 'destructive', title: 'Network Error', description: 'Failed to add Sepolia network to your wallet.' });
                throw addError;
            }
        } else {
             console.error('Failed to switch to Sepolia network:', switchError);
             toast({ variant: 'destructive', title: 'Network Error', description: 'Please switch to the Sepolia test network in your wallet.' });
             throw switchError;
        }
    }
}


// --- Service Functions ---

export const connectWallet = async (): Promise<string | null> => {
    if (typeof window.ethereum === 'undefined') {
        toast({ variant: 'destructive', title: 'MetaMask Not Found', description: 'Please install a wallet extension like MetaMask to use this dApp.' });
        return null;
    }
    
    let selectedProvider: (Eip1193Provider & { isMetaMask?: boolean; }) | null = null;

    if (window.ethereum.providers) {
        selectedProvider = window.ethereum.providers.find(p => p.isMetaMask) ?? window.ethereum.providers[0];
    } else {
        selectedProvider = window.ethereum;
    }

    if (!selectedProvider) {
         toast({ variant: 'destructive', title: 'No Wallet Found', description: 'Could not detect a wallet provider.' });
         return null;
    }

    try {
        await switchOrAddSepoliaNetwork(selectedProvider);
        const accounts = await selectedProvider.request({ method: 'eth_requestAccounts' });
        
        initializeProviderAndContract(selectedProvider);

        return accounts[0] || null;
    } catch (error) {
        console.error("Error connecting to wallet:", error);
        if ((error as any).code !== 4001) {
            toast({ variant: 'destructive', title: 'Connection Failed', description: 'Could not connect to wallet.' });
        }
        return null;
    }
};

export const getAllCampaigns = async (): Promise<Campaign[]> => {
    const contractToUse = readOnlyContract;
    if (!contractToUse) {
        console.warn("Contract not initialized, trying to initialize read-only...");
        initializeReadOnlyProvider();
        if (!readOnlyContract) {
            toast({ variant: 'destructive', title: 'Contract Error', description: 'Could not connect to the campaign contract. Please check your configuration and network.' });
            return [];
        }
        // If it was just initialized, use it
        return getAllCampaigns();
    }

    try {
        const campaignCountBigInt = await contractToUse.getCampaignCount();
        const campaignCount = Number(campaignCountBigInt);

        if (campaignCount === 0) return [];
        
        const campaigns = [];
        // Start from 1 as campaign IDs are 1-based index
        for (let i = 1; i <= campaignCount; i++) {
            try {
                const campaignData = await contractToUse.getCampaign(i);
                if (Number(campaignData.status) !== 3) { // Not 'Closed'
                    campaigns.push(mapContractDataToCampaign(campaignData, i));
                }
            } catch (error) {
                 console.error(`Failed to fetch campaign ${i}:`, error);
            }
        }
        // Show active and ended campaigns, but not drafts
        return campaigns.filter(c => c.status === 'Active' || c.status === 'Ended');
    } catch (error: any) {
        if (error.code === 'CALL_EXCEPTION') {
            console.error("Contract call failed. Check contract address and network.", error)
            toast({ variant: 'destructive', title: 'Contract Error', description: 'Could not connect to the campaign contract. Please check your configuration and network.' });
        } else {
            console.error("Error fetching campaigns:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch campaign data.' });
        }
        return [];
    }
};

export const getCampaignsByHostAddress = async (hostAddress: string): Promise<Campaign[]> => {
    const contractToUse = readOnlyContract ?? contract;
    if (!contractToUse) {
        console.warn("Contract not initialized for getting host campaigns.");
        return [];
    }

    try {
        const campaignIdsBigInt: bigint[] = await contractToUse.getCampaignsByHost(hostAddress);
        const campaignIds = campaignIdsBigInt.map(id => Number(id));

        if (campaignIds.length === 0) return [];

        const campaigns = await Promise.all(
            campaignIds.map(async (id) => {
                try {
                    const campaignData = await contractToUse.getCampaign(id);
                    return mapContractDataToCampaign(campaignData, id);
                } catch (error) {
                    console.error(`Failed to fetch campaign ${id} for host ${hostAddress}:`, error);
                    return null;
                }
            })
        );
        
        return campaigns.filter((c): c is Campaign => c !== null);
    } catch (error) {
        console.error(`Error fetching campaigns for host ${hostAddress}:`, error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your campaigns.' });
        return [];
    }
};


export const getCampaignById = async (id: string): Promise<Campaign | null> => {
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) return null;

    const contractToUse = contract ?? readOnlyContract;
     if (!contractToUse) {
        console.warn("Neither wallet contract nor read-only contract is available.");
        toast({ variant: 'destructive', title: 'Error', description: 'Could not connect to blockchain.' });
        return null;
    }
    try {
        const campaignData = await contractToUse.getCampaign(id);
        return mapContractDataToCampaign(campaignData, parseInt(id));
    } catch (error) {
        console.error(`Error fetching campaign ${id}:`, error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch campaign data.' });
        return null;
    }
};

export const createCampaign = async (campaignData: any) => {
    if (!contract) throw new Error("Contract not initialized");
    const signer = await getSigner();
    const contractWithSigner = contract.connect(signer) as Contract;
    
    // Create campaign with a start time 100 years in the future to keep it in Draft
    const DRAFT_START_TIME_OFFSET = 100 * 365 * 24 * 60 * 60; // 100 years in seconds
    const draftStartTime = Math.floor(Date.now() / 1000) + DRAFT_START_TIME_OFFSET;
    
    const durationInSeconds = differenceInSeconds(campaignData.dates.to, campaignData.dates.from);
    const draftEndTime = draftStartTime + durationInSeconds;


    const taskTypeMap: Record<TaskType, number> = {
        'SOCIAL_FOLLOW': 0,
        'JOIN_DISCORD': 1,
        'RETWEET': 2,
        'ONCHAIN_TX': 3
    };

    try {
        // 1. Create Campaign
        const tx = await contractWithSigner.createCampaign(campaignData.title, draftStartTime, draftEndTime);
        const receipt = await tx.wait();
        
        const event = receipt.logs.map((log: any) => {
            try {
                return contract.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        }).find((e: any) => e && e.name === 'CampaignCreated');
        
        if (!event) throw new Error("CampaignCreated event not found");
        const campaignId = event.args.campaignId.toString();

        // 2. Add Tasks
        for (const task of campaignData.tasks) {
            const taskType = taskTypeMap[task.type as TaskType];
            const verificationDataBytes = ethers.encodeBytes32String(task.verificationData || "");
            const taskTx = await contractWithSigner.addTaskToCampaign(campaignId, taskType, task.description, verificationDataBytes, false);
            await taskTx.wait();
        }

        // 3. Set Reward
        let rewardType;
        let tokenAddress = ethers.ZeroAddress;
        let rewardAmount: string | bigint = '0';

        switch (campaignData.reward.type) {
            case 'ERC20':
                rewardType = 0;
                tokenAddress = campaignData.reward.tokenAddress;
                rewardAmount = ethers.parseUnits(campaignData.reward.amount || '0', 18);
                break;
            case 'ERC721':
                rewardType = 1;
                tokenAddress = campaignData.reward.tokenAddress;
                rewardAmount = '0';
                break;
            case 'None':
                rewardType = 2;
                break;
            default:
                throw new Error("Invalid reward type");
        }
        
        if (rewardType !== 2) {
            const rewardTx = await contractWithSigner.setCampaignReward(campaignId, rewardType, tokenAddress, rewardAmount);
            await rewardTx.wait();
        }

        toast({ title: 'Success!', description: 'Your campaign has been created in Draft status. Open it from your dashboard.' });
        return campaignId;
    } catch(error: any) {
        console.error("Error creating campaign:", error);
        const reason = error.reason || error.message;
        let description = `Transaction failed: ${reason}`;
        
        if (error.code === 'CALL_EXCEPTION' && !reason) {
            description = 'Transaction failed. This may be due to an invalid campaign duration, or another contract requirement was not met.';
        } else if (reason?.includes("Campaign not in active period")) {
             description = `The campaign is not in an active period for this action.`
        }
        
        toast({ variant: 'destructive', title: 'Transaction Failed', description });
        throw error;
    }
};

export const hasParticipated = async (campaignId: string, participantAddress: string): Promise<boolean> => {
    const contractToUse = contract ?? readOnlyContract;
    if (!contractToUse || !participantAddress) return false;
    try {
        return await contractToUse.hasParticipated(campaignId, participantAddress);
    } catch (error) {
        console.error(`Error checking participation for ${participantAddress} in campaign ${campaignId}:`, error);
        // Don't show a toast for this, as it might be called frequently
        return false;
    }
}

export const isHost = async (address: string): Promise<boolean> => {
    const contractToUse = readOnlyContract ?? contract;
    if (!contractToUse || !address) return false;
    try {
        const hostRole = await contractToUse.HOST_ROLE();
        return await contractToUse.hasRole(hostRole, address);
    } catch (error) {
        console.error("Error checking for host role:", error);
        return false;
    }
};

export const becomeHost = async () => {
    if (!contract) throw new Error("Contract not initialized");
    const signer = await getSigner();
    const contractWithSigner = contract.connect(signer) as Contract;
    try {
        const tx = await contractWithSigner.grantHostRole(signer.address);
        await tx.wait();
        toast({ title: 'Success!', description: `You have been granted the HOST_ROLE.` });
    } catch (error: any) {
        console.error("Error granting host role:", error);
        const reason = error.reason || "An unknown error occurred.";
        toast({ variant: 'destructive', title: 'Transaction Failed', description: `Failed to get host role. Reason: ${reason}` });
        throw error;
    }
};

export const openCampaign = async (campaignId: string) => {
    if (!contract) throw new Error("Contract not initialized");
    const signer = await getSigner();
    const contractWithSigner = contract.connect(signer) as Contract;

    try {
        const tx = await contractWithSigner.openCampaign(campaignId);
        await tx.wait();
        toast({ title: 'Campaign is now Active!', description: `Campaign ${campaignId} has been successfully opened.` });
    } catch (error: any) {
        console.error(`Error opening campaign ${campaignId}:`, error);
        let reason = "An unknown error occurred.";
        if (error.reason && error.reason.includes("start time not yet started")) {
            reason = "The campaign's start time has not been reached yet.";
        } else if (error.reason) {
            reason = error.reason;
        }
        
        toast({ variant: 'destructive', title: 'Transaction Failed', description: `Failed to open campaign. Reason: ${reason}` });
        throw error;
    }
};

export const endCampaign = async (campaignId: string) => {
    if (!contract) throw new Error("Contract not initialized");
    const signer = await getSigner();
    const contractWithSigner = contract.connect(signer) as Contract;
    try {
        const tx = await contractWithSigner.endCampaign(campaignId);
        await tx.wait();
        toast({ title: 'Campaign Ended', description: `Campaign ${campaignId} has been successfully ended.` });
    } catch (error: any) {
        console.error(`Error ending campaign ${campaignId}:`, error);
        const reason = error.reason || "An unknown error occurred.";
        toast({ variant: 'destructive', title: 'Transaction Failed', description: `Failed to end campaign. Reason: ${reason}` });
        throw error;
    }
};

export const completeTask = async (campaignId: string, taskIndex: number, userAddress: string) => {
    if (!contract) throw new Error("Contract not initialized");
    
    // This function can now be called by the backend verifier.
    // It needs a signer, which in a real app would be a secure backend wallet.
    // For local development, it will still use the user's connected wallet.
    const signer = await getSigner();
    const contractWithSigner = contract.connect(signer) as Contract;
    
    try {
        // The address to complete the task for is now passed as an argument.
        const tx = await contractWithSigner.completeTask(campaignId, taskIndex, userAddress);
        await tx.wait();
    } catch (error: any) {
        console.error(`Error completing task ${taskIndex} for campaign ${campaignId}:`, error);
        let description = `Failed to complete task.`;
        if (error.reason && error.reason.includes("Campaign not in active period")) {
             description = `This campaign is not currently active.`
        } else if (error.reason) {
            description += ` Reason: ${error.reason}`;
        }
        toast({ variant: 'destructive', title: 'Transaction Failed', description });
        throw error;
    }
}

export const getCampaignParticipants = async (campaign: Campaign): Promise<ParticipantData[]> => {
    const contractToUse = readOnlyContract;
    if (!contractToUse) return [];
    try {
        const provider = contractToUse.provider;
        if (!provider) return [];
        const latestBlock = await provider.getBlockNumber();
        
        const maxRange = 50000;
        const startBlock = Math.max(0, latestBlock - 49999);

        let events: any[] = [];
        for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += maxRange) {
            const toBlock = Math.min(fromBlock + maxRange - 1, latestBlock);
            const filter = contractToUse.filters.ParticipantTaskCompleted(campaign.id);
            const chunkEvents = await contractToUse.queryFilter(filter, fromBlock, toBlock);
            events.push(...chunkEvents);
        }

        const participantTaskCompletion = new Map<string, Set<string>>();
        for (const event of events) {
            const [_, participant, taskId] = event.args;
            const taskIdStr = taskId.toString();
            if (!participantTaskCompletion.has(participant)) {
                participantTaskCompletion.set(participant, new Set<string>());
            }
            participantTaskCompletion.get(participant)!.add(taskIdStr);
        }

        const participantAddresses = Array.from(participantTaskCompletion.keys());
        const participantData = await Promise.all(participantAddresses.map(async (address) => {
            const hasClaimed = await contractToUse.hasClaimedReward(campaign.id, address);
            const completedTasksCount = participantTaskCompletion.get(address)?.size || 0;
            return {
                address,
                tasksCompleted: completedTasksCount,
                claimed: hasClaimed
            };
        }));

        return participantData;
    } catch (error) {
        console.error("Error fetching participants:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch participant data.' });
        return [];
    }
}

export const isPaused = async (): Promise<boolean> => {
    const contractToUse = readOnlyContract;
    if (!contractToUse) return false;
    try {
        return await contractToUse.paused();
    } catch (error) {
        console.error("Error checking for paused state:", error);
        return false;
    }
}

