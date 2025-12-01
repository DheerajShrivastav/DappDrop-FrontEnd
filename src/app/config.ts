import { ethers } from 'ethers'

// It is a good practice to centralize your configuration.
// This file reads environment variables and exports them as a typed object.

// Validate contract address at module load time
const campaignFactoryAddress =
  process.env.NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT || ''

if (
  campaignFactoryAddress &&
  !ethers.isAddress(campaignFactoryAddress)
) {
  throw new Error(
    `Invalid Ethereum address for NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT: ${campaignFactoryAddress}`
  )
}

const config = {
  campaignFactoryAddress,
  sepoliaRpcUrl:
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    'https://ethereum-sepolia.publicnode.com',
  humanityPortalUrl:
    process.env.NEXT_PUBLIC_HUMANITY_PORTAL_URL ||
    'https://testnet.humanity.org',
  apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT,
  discordBotInviteUrl: process.env.NEXT_PUBLIC_DISCORD_BOT_INVITE_URL,
  telegramBotUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
  uploadthingAppId: process.env.UPLOADTHING_APP_ID || '',
}

// Warn if critical config is missing (only in development)
if (process.env.NODE_ENV === 'development') {
  if (!config.campaignFactoryAddress) {
    console.warn(
      '⚠️  NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT is not set. Web3 functionality will not work.'
    )
  }
}

export default config
