


import { ethers, BrowserProvider, Contract, Eip1193Provider } from 'ethers';
import { toast } from '@/hooks/use-toast';
import type { Campaign } from './types';
import config from '@/app/config';
import Web3Campaigns from './abi/Web3Campaigns.json';
import { endOfDay } from 'date-fns';

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
const SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

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
        tasks: contractData.tasks.map((task: any, index: number) => ({
            id: index.toString(),
            type: 'ONCHAIN_TX', // Placeholder type
            description: task.description,
        })),
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
        // Show active and ended campaigns
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
    
    const startTime = Math.floor(campaignData.dates.from.getTime() / 1000);
    // Ensure end time is always after start time
    const endTime = Math.floor(endOfDay(campaignData.dates.to).getTime() / 1000);

    try {
        const tx = await contractWithSigner.createCampaign(campaignData.title, startTime, endTime);
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
        
        let rewardType;
        let tokenAddress = ethers.ZeroAddress;
        let rewardAmount = '0';

        switch(campaignData.reward.type) {
            case 'ERC20':
                rewardType = 0;
                tokenAddress = campaignData.reward.tokenAddress;
                rewardAmount = ethers.parseUnits(campaignData.reward.amount, 18);
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


        // Add tasks
        for (const task of campaignData.tasks) {
            const taskType = 0; // Placeholder for ONCHAIN_TX - assuming all tasks are generic for now
            const taskTx = await contractWithSigner.addTaskToCampaign(campaignId, taskType, task.description, "0x", false);
            await taskTx.wait();
        }

        toast({ title: 'Success!', description: 'Your campaign has been created on-chain.' });
        return campaignId;
    } catch(error: any) {
        console.error("Error creating campaign:", error);
        const reason = error.reason || error.message;
        let description = `Transaction failed: ${reason}`;
        
        // This is a generic way to check for custom errors.
        if (error.data?.includes('0x6352211e')) { // Web3Campaigns__CallerIsNotHost
            description = 'Your wallet does not have the HOST_ROLE. Please ask the contract owner to grant you this role.';
        } else if (error.data?.includes('0xa1c02e1f')) { // Web3Campaigns__InvalidCampaignDuration
            description = 'Invalid campaign duration. The end date must be after the start date.';
        } else if (error.code === 'CALL_EXCEPTION' && !reason) {
            description = 'Transaction failed. This may be due to your wallet not having the HOST_ROLE, an invalid campaign duration, or another contract requirement was not met. Please contact the contract administrator.';
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

export const isSuperAdmin = async (address: string): Promise<boolean> => {
    const contractToUse = contract ?? readOnlyContract;
    if (!contractToUse || !address) return false;
    try {
        const adminRole = await contractToUse.DEFAULT_ADMIN_ROLE();
        const hasAdminRole = await contractToUse.hasRole(adminRole, address);
        return hasAdminRole;
    } catch (error) {
        console.error("Error checking for admin role:", error);
        return false;
    }
};

export const isHost = async (address: string): Promise<boolean> => {
    const contractToUse = contract ?? readOnlyContract;
    if (!contractToUse || !address) return false;
    try {
        const hostRole = await contractToUse.HOST_ROLE();
        return await contractToUse.hasRole(hostRole, address);
    } catch (error) {
        console.error("Error checking for host role:", error);
        return false;
    }
}

export const getAllHosts = async (): Promise<string[]> => {
    const contractToUse = readOnlyContract;
    if (!contractToUse) return [];
    try {
        const hostRole = await contractToUse.HOST_ROLE();
        const filter = contractToUse.filters.RoleGranted(hostRole);
        const events = await contractToUse.queryFilter(filter, 0, 'latest');
        const hosts = events.map(event => (event.args as any).account);
        // We need to also check who has been revoked
        const revokedFilter = contractToUse.filters.RoleRevoked(hostRole);
        const revokedEvents = await contractToUse.queryFilter(revokedFilter, 0, 'latest');
        const revokedHosts = new Set(revokedEvents.map(event => (event.args as any).account));

        const uniqueHosts = [...new Set(hosts)].filter(host => !revokedHosts.has(host));
        return uniqueHosts;

    } catch (error) {
        console.error("Error fetching hosts:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch host list.' });
        return [];
    }
}


export const grantHostRole = async (address: string) => {
    if (!contract) throw new Error("Contract not initialized");
    const signer = await getSigner();
    const contractWithSigner = contract.connect(signer) as Contract;
    try {
        const tx = await contractWithSigner.grantHostRole(address);
        await tx.wait();
        toast({ title: 'Success!', description: `HOST_ROLE granted to ${address}` });
    } catch (error: any) {
        console.error("Error granting host role:", error);
        const reason = error.reason || "An unknown error occurred.";
        toast({ variant: 'destructive', title: 'Transaction Failed', description: `Failed to grant host role. Reason: ${reason}` });
        throw error;
    }
};

export const revokeHostRole = async (address: string) => {
    if (!contract) throw new Error("Contract not initialized");
    const signer = await getSigner();
    const contractWithSigner = contract.connect(signer) as Contract;
    try {
        const tx = await contractWithSigner.revokeHostRole(address);
        await tx.wait();
        toast({ title: 'Success!', description: `HOST_ROLE revoked from ${address}` });
    } catch (error: any) {
        console.error("Error revoking host role:", error);
        const reason = error.reason || "An unknown error occurred.";
        toast({ variant: 'destructive', title: 'Transaction Failed', description: `Failed to revoke host role. Reason: ${reason}` });
        throw error;
    }
}

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
        const reason = error.reason || "An unknown error occurred.";
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

export const completeTask = async (campaignId: string, taskIndex: number) => {
    if (!contract) throw new Error("Contract not initialized");
    const signer = await getSigner();
    const contractWithSigner = contract.connect(signer) as Contract;
    try {
        const tx = await contractWithSigner.completeTask(campaignId, taskIndex);
        await tx.wait();
    } catch (error: any) {
        console.error(`Error completing task ${taskIndex} for campaign ${campaignId}:`, error);
        let description = `Failed to complete task.`;
        if (error.reason) {
            description += ` Reason: ${error.reason}`;
        }
        toast({ variant: 'destructive', title: 'Transaction Failed', description });
        throw error;
    }
}

    