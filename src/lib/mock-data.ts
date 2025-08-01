import { addDays, subDays } from 'date-fns';
import type { Campaign } from './types';

const now = new Date();

export const campaigns: Campaign[] = [
  {
    id: 'luna-airdrop',
    title: 'Luna DAO Token Airdrop',
    description: 'Join the Luna DAO and get a chance to win LUNA tokens.',
    longDescription:
      'Luna DAO is a new decentralized autonomous organization focused on funding interstellar exploration. To celebrate our launch, we are airdropping LUNA tokens to early supporters who complete a few simple tasks. This is your chance to be part of the future of space funding.',
    startDate: subDays(now, 10),
    endDate: addDays(now, 20),
    status: 'Active',
    participants: 10234,
    host: '0xHostAccountForLuna',
    tasks: [
      { id: '1', type: 'SOCIAL_FOLLOW', description: 'Follow @LunaDAO on X' },
      { id: '2', type: 'JOIN_DISCORD', description: 'Join the Luna DAO Discord server' },
      { id: '3', type: 'RETWEET', description: 'Retweet our announcement post' },
    ],
    reward: { type: 'ERC20', tokenAddress: '0x123...', amount: '500', name: '500 LUNA Tokens' },
    imageUrl: 'https://placehold.co/600x400',
    'data-ai-hint': 'galaxy stars',
  },
  {
    id: 'sol-defi-drop',
    title: 'Solana DeFi Power Drop',
    description: 'Get exclusive access to the new Solana DeFi platform.',
    longDescription:
      'We are launching a revolutionary new DeFi platform on Solana. Be among the first to experience it and earn rewards. Complete the tasks to secure your spot and a special token allocation.',
    startDate: subDays(now, 5),
    endDate: addDays(now, 15),
    status: 'Active',
    participants: 7845,
    host: '0xHostAccountForSolana',
    tasks: [
      { id: '1', type: 'SOCIAL_FOLLOW', description: 'Follow @SolDeFi on X' },
      { id: '2', type: 'JOIN_DISCORD', description: 'Join our Telegram group' },
      { id: '3', type: 'ONCHAIN_TX', description: 'Sign up for our newsletter' },
    ],
    reward: { type: 'ERC20', tokenAddress: '0x456...', amount: '100', name: '100 SDF Tokens' },
    imageUrl: 'https://placehold.co/600x400',
    'data-ai-hint': 'futuristic city',
  },
  {
    id: 'pixel-nft-giveaway',
    title: 'Pixel Art NFT Giveaway',
    description: 'A special collection of pixel art NFTs for our community.',
    longDescription:
      'To thank our amazing community, we are giving away a limited edition collection of pixel art NFTs. Each NFT is unique and handcrafted by our talented artists. Complete the tasks for a chance to mint one for free.',
    startDate: subDays(now, 30),
    endDate: subDays(now, 2),
    status: 'Ended',
    participants: 25102,
    host: '0xHostAccountForPixel',
    tasks: [
        { id: '1', type: 'SOCIAL_FOLLOW', description: 'Follow @PixelArt on Instagram' },
        { id: '2', type: 'RETWEET', description: 'Share your favorite pixel art' },
    ],
    reward: { type: 'ERC721', tokenAddress: '0x789...', name: '1 Limited Edition NFT' },
    imageUrl: 'https://placehold.co/600x400',
    'data-ai-hint': 'pixel art',
  },
  {
    id: 'eco-chain-rewards',
    title: 'EcoChain Early Adopter Rewards',
    description: 'Support a green blockchain and earn ECO tokens.',
    longDescription: 'EcoChain is a proof-of-stake blockchain with a focus on sustainability. We are rewarding our early adopters with ECO tokens. Join the movement towards a greener future for crypto.',
    startDate: addDays(now, 5),
    endDate: addDays(now, 45),
    status: 'Draft',
    participants: 1200,
    host: '0xHostAccountForEco',
    tasks: [
      { id: '1', type: 'ONCHAIN_TX', description: 'Read our whitepaper' },
      { id: '2', type: 'JOIN_DISCORD', description: 'Join our community forum' },
      { id: '3', type: 'ONCHAIN_TX', description: 'Stake 10 testnet tokens' },
    ],
    reward: { type: 'ERC20', tokenAddress: '0xabc...', amount: '1000', name: '1000 ECO Tokens' },
    imageUrl: 'https://placehold.co/600x400',
    'data-ai-hint': 'forest canopy',
  },
];
