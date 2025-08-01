
import { ethers, BrowserProvider, Contract, Eip1193Provider } from 'ethers';
import { toast } from '@/hooks/use-toast';
import type { Campaign } from './types';
import config from '@/app/config';
import Web3Campaigns from './abi/Web3Campaigns.json';

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

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // Sepolia chain id in hex
const SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID';

const initializeProvider = () => {
    if (typeof window !== 'undefined' && window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
    } else {
        console.warn('MetaMask not found. Please install MetaMask to use this dApp.');
        provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    }

    if (config.campaignFactoryAddress && provider) {
        contract = new ethers.Contract(config.campaignFactoryAddress, Web3Campaigns.abi, provider);
    }
}
initializeProvider();


// --- Helper Functions ---

const getSigner = async () => {
  if (!provider || !(window.ethereum)) {
    toast({ variant: 'destructive', title: 'Wallet not connected', description: 'Please connect your wallet.' });
    throw new Error('Wallet not connected');
  }
  return provider.getSigner();
};


const mapContractDataToCampaign = (contractData: any, id: number): Campaign => {
    const statusMap = ['Draft', 'Active', 'Ended', 'Closed'];
    const rewardTypeMap = ['ERC20', 'ERC721', 'None'];

    let rewardName = `Reward for ${contractData.name}`;
    if (Number(contractData.reward.rewardType) === 2) { // "None" type
        // For "None", the reward details are stored off-chain.
        // We'll need a way to get this. For now, using a placeholder.
        // In a real app, you might fetch this from a DB using the campaignId.
        rewardName = "A special off-chain reward";
    }


    return {
        id: id.toString(),
        title: contractData.name,
        description: `A campaign hosted by ${contractData.host}`, // Short description placeholder
        longDescription: `A campaign hosted by ${contractData.host} with the name ${contractData.name}. More details can be found on the blockchain.`, // Long description placeholder
        startDate: new Date(Number(contractData.startTime) * 1000),
        endDate: new Date(Number(contractData.endTime) * 1000),
        status: statusMap[Number(contractData.status)] as 'Draft' | 'Active' | 'Ended',
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
        // This error code indicates that the chain has not been added to MetaMask.
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

    // Handle multiple wallet extensions
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
        // Re-initialize ethers provider with the selected wallet provider
        provider = new ethers.BrowserProvider(selectedProvider);
        if (config.campaignFactoryAddress && provider) {
            contract = new ethers.Contract(config.campaignFactoryAddress, Web3Campaigns.abi, provider);
        }

        await switchOrAddSepoliaNetwork(selectedProvider);
        const accounts = await selectedProvider.request({ method: 'eth_requestAccounts' });
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
    if (!contract) return [];
    try {
        const campaignCountBigInt = await contract.getCampaignCount();
        const campaignCount = Number(campaignCountBigInt);

        if (typeof campaignCount === 'undefined' || campaignCount === null) {
            console.error("getCampaignCount returned undefined or null");
            return [];
        }
        const campaigns = [];
        for (let i = 0; i < campaignCount; i++) {
            try {
                const campaignData = await contract.getCampaign(i);
                campaigns.push(mapContractDataToCampaign(campaignData, i));
            } catch (error) {
                 console.error(`Failed to fetch campaign ${i}:`, error);
            }
        }
        return campaigns.filter(c => c.status !== 'Draft'); // Only show non-draft campaigns
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

export const getCampaignById = async (id: string): Promise<Campaign | null> => {
    if (!contract) return null;
    try {
        const campaignData = await contract.getCampaign(id);
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
    const endTime = Math.floor(campaignData.dates.to.getTime() / 1000);

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
                break;
            case 'None':
                rewardType = 2;
                // For "None" type, we can store the description off-chain.
                // The on-chain function does not need a name for it.
                break;
            default:
                throw new Error("Invalid reward type");
        }

        const rewardTx = await contractWithSigner.setCampaignReward(campaignId, rewardType, tokenAddress, rewardAmount);
        await rewardTx.wait();


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
        let description = reason;
        if (reason && reason.includes('caller is not the host')) {
            description = 'Your wallet does not have the HOST_ROLE. Please ask the contract owner to grant you this role.';
        } else if (error.code === 'CALL_EXCEPTION') {
            description = 'Transaction failed. This may be due to your wallet not having the HOST_ROLE to create campaigns. Please contact the contract administrator.';
        }
        
        toast({ variant: 'destructive', title: 'Transaction Failed', description });
        throw error;
    }
};
