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
    };
  }
}

// --- Ethers Setup ---
let provider: BrowserProvider | null = null;
let contract: Contract | null = null;

if (typeof window !== 'undefined' && window.ethereum) {
  provider = new ethers.BrowserProvider(window.ethereum);
} else {
  console.warn('MetaMask not found. Please install MetaMask to use this dApp.');
  // Use a read-only provider for Sepolia if no wallet is present
  provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_ID || 'YOUR_INFURA_ID'}`);
}

if (config.campaignFactoryAddress && provider) {
  contract = new ethers.Contract(config.campaignFactoryAddress, Web3Campaigns.abi, provider);
}

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
    const rewardTypeMap = ['ERC20', 'ERC721'];

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
            type: rewardTypeMap[Number(contractData.reward.rewardType)] as 'ERC20' | 'ERC721',
            tokenAddress: contractData.reward.tokenAddress,
            amount: contractData.reward.amountOrTokenId.toString(),
            name: `Reward for ${contractData.name}`, // Placeholder
        },
        imageUrl: `https://placehold.co/600x400`,
        'data-ai-hint': 'blockchain technology',
    };
};

// --- Service Functions ---

export const connectWallet = async (): Promise<string | null> => {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      return accounts[0] || null;
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
      toast({ variant: 'destructive', title: 'Connection Failed', description: 'Could not connect to wallet.' });
      return null;
    }
  }
  toast({ variant: 'destructive', title: 'MetaMask Not Found', description: 'Please install MetaMask to use this dApp.' });
  return null;
};

export const getAllCampaigns = async (): Promise<Campaign[]> => {
    if (!contract) return [];
    try {
        const campaignCount = await contract.getCampaignCount();
        if (typeof campaignCount === 'undefined') {
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
    } catch (error) {
        console.error("Error fetching campaigns:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch campaign data.' });
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
        
        // Find CampaignCreated event to get the new campaignId
        const event = receipt.logs.map((log: any) => contract.interface.parseLog(log)).find((e: any) => e.name === 'CampaignCreated');
        
        if (!event) throw new Error("CampaignCreated event not found");
        const campaignId = event.args.campaignId.toString();

        // Set reward
        const rewardType = campaignData.reward.type === 'ERC20' ? 0 : 1;
        
        const rewardAmount = campaignData.reward.type === 'ERC20' 
            ? ethers.parseUnits(campaignData.reward.amount, 18) 
            : '1';
        
        const rewardTx = await contractWithSigner.setCampaignReward(campaignId, rewardType, campaignData.reward.tokenAddress, rewardAmount);
        await rewardTx.wait();

        // Add tasks
        for (const task of campaignData.tasks) {
            const taskType = 0; // Placeholder for SOCIAL_FOLLOW
            const taskTx = await contractWithSigner.addTaskToCampaign(campaignId, taskType, task.description, "0x", false);
            await taskTx.wait();
        }

        toast({ title: 'Success!', description: 'Your campaign has been created on-chain.' });
        return campaignId;
    } catch(error: any) {
        console.error("Error creating campaign:", error);
        toast({ variant: 'destructive', title: 'Transaction Failed', description: error.message });
        throw error;
    }
};
