import { Client, GatewayIntentBits } from 'discord.js'

let client: Client | null = null

export function getDiscordClient() {
  if (!client) {
    client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    })
    client.login(process.env.DISCORD_BOT_TOKEN)
  }
  return client
}
