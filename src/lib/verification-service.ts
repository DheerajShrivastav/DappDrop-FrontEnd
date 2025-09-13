// This service would contain the logic to verify off-chain tasks.
// For example, by interacting with the Twitter or Discord APIs.

/**
 * Verifies if a given user (identified by their Discord username) has joined
 * a specific Discord server.
 *
 * In a real-world scenario, this would involve:
 * 1. Setting up a Discord Bot for your application.
 * 2. Adding the Bot to your guild (server) with necessary permissions (e.g., 'GUILD_MEMBERS').
 * 3. Using a library like `discord.js` or `axios` to query the Discord API's
 *    "Get Guild Member" endpoint: GET /guilds/{guild.id}/members/{user.id}
 *    or searching for the member by username.
 * 4. You would need to translate the provided `discordUsername` into a Discord User ID first,
 *    which usually requires another API call or a user linking process.
 *
 * For now, this function will simulate a successful verification.
 *
 * @param discordUsername - The Discord username of the participant.
 * @param discordServerId - The ID of the Discord server to check.
 * @returns A promise that resolves to true if the user is in the server, false otherwise.
 */
export const verifyDiscordJoin = async (
  discordUsername: string,
  discordServerId: string,
  discordId?: string
): Promise<boolean> => {
  console.log(
    `Verifying if user "${discordUsername}" (ID: ${
      discordId || 'unknown'
    }) joined Discord server ${discordServerId}`
  )

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('Discord bot token is not configured')
    throw new Error(
      'Discord bot token is missing. Please check your environment variables.'
    )
  }

  // If we have a discordId from OAuth, we can perform a more accurate verification
  if (discordId) {
    console.log('Using OAuth Discord ID for verification')
    try {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${discordServerId}/members/${discordId}`,
        {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        }
      )

      if (response.ok) {
        // If the member exists in the guild, they are verified
        console.log(
          `User with ID ${discordId} is a member of Discord server ${discordServerId}`
        )
        return true
      }

      if (response.status === 404) {
        // User is not in the guild
        console.log(
          `User with ID ${discordId} is NOT a member of Discord server ${discordServerId}`
        )
        return false
      }

      console.error('Failed to query Discord API:', response.statusText)
      const errorData = await response.text()
      console.error('Error details:', errorData)
      return false
    } catch (error) {
      console.error('Error verifying Discord join with ID:', error)
      return false
    }
  } else {
    // Fallback to username-based verification
    console.log('Falling back to username-based verification')
    try {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${discordServerId}/members/search?query=${encodeURIComponent(
          discordUsername
        )}&limit=10`,
        {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
        }
      )

      if (!response.ok) {
        console.error('Failed to query Discord API:', response.statusText)
        const errorData = await response.text()
        console.error('Error details:', errorData)
        return false
      }

      const members = await response.json()

      if (!Array.isArray(members) || members.length === 0) {
        console.log(`No members found with username ${discordUsername}`)
        return false
      }

      // Check if any of the returned members match the username
      // Discord usernames are case-sensitive
      const usernameMatch = members.some((member: any) => {
        const memberUsername = member.user?.username
        return memberUsername === discordUsername
      })

      console.log(
        `Username verification result: ${
          usernameMatch ? 'User found in server' : 'User not found in server'
        }`
      )
      return usernameMatch
    } catch (error) {
      console.error('Error verifying Discord join with username:', error)
      return false
    }
  }

  // If execution reaches here, both verification methods failed
  return false
}
