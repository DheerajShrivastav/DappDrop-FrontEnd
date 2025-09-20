// It is a good practice to centralize your configuration.
// This file reads environment variables and exports them as a typed object.

const config = {
  // Example of a contract address. Add more as needed.
  // You can get this value from the .env.local file.
  campaignFactoryAddress: process.env.NEXT_PUBLIC_CAMPAIGN_FACTORY_CONTRACT,

  // Example of a backend API endpoint.
  // You can get this value from the .env.local file.
  apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT,

  // Discord bot invite URL for hosts to add the bot to their servers
  // This enables automatic verification of Discord join tasks
  discordBotInviteUrl: process.env.NEXT_PUBLIC_DISCORD_BOT_INVITE_URL,
}

export default config
