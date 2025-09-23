/**
 * Verifies if a Discord user has joined a specific Discord server using our Discord Bot.
 *
 * This function performs real Discord API verification by:
 * 1. Using our configured Discord Bot with the necessary permissions
 * 2. Querying Discord's REST API to check server membership
 * 3. Supporting both Discord ID (from OAuth) and username-based verification
 * 4. Providing accurate membership verification for campaign tasks
 *
 * @param discordUsername - The Discord username of the participant
 * @param discordServerId - The ID of the Discord server to check membership for
 * @param discordId - Optional Discord user ID (more accurate when available from OAuth)
 * @returns Promise<boolean> - true if user is verified as a server member, false otherwise
 * @throws Error if Discord bot token is not configured
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

  // Primary verification method: Use Discord ID from OAuth (most accurate)
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
        console.log(
          `User with ID ${discordId} is a member of Discord server ${discordServerId}`
        )
        return true
      }

      if (response.status === 404) {
        console.log(
          `User with ID ${discordId} is NOT a member of Discord server ${discordServerId}`
        )
        return false
      }

      console.error('Discord API error:', response.status, response.statusText)
      return false
    } catch (error) {
      console.error('Error verifying Discord membership with ID:', error)
      return false
    }
  }

  // Fallback verification method: Search by username (less reliable)
  console.log('Using username-based verification as fallback')
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
      console.error('Discord API error:', response.status, response.statusText)
      return false
    }

    const members = await response.json()

    if (!Array.isArray(members) || members.length === 0) {
      console.log(`No members found with username "${discordUsername}"`)
      return false
    }

    // Check for exact username match (Discord usernames are case-sensitive)
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
    console.error('Error verifying Discord membership with username:', error)
    return false
  }
}

/**
 * Verifies if a Telegram user has joined a specific Telegram channel/group using our Telegram Bot.
 *
 * This function performs real Telegram Bot API verification by:
 * 1. Using our configured Telegram Bot with the necessary permissions
 * 2. Querying Telegram's Bot API to check channel/group membership
 * 3. Supporting both username and user ID-based verification
 * 4. Providing accurate membership verification for campaign tasks
 *
 * @param telegramUsername - The Telegram username of the participant (without @)
 * @param telegramChatId - The Telegram channel/group chat ID (e.g., @channelname or -100123456789)
 * @param telegramUserId - Optional Telegram user ID (more accurate when available)
 * @returns Promise<boolean> - true if user is verified as a channel/group member, false otherwise
 * @throws Error if Telegram bot token is not configured
 */
export const verifyTelegramJoin = async (
  telegramUsername: string,
  telegramChatId: string,
  telegramUserId?: string
): Promise<boolean> => {
  console.log(
    `Verifying if user "${telegramUsername}" (ID: ${
      telegramUserId || 'unknown'
    }) joined Telegram channel/group ${telegramChatId}`
  )

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('Telegram bot token is not configured')
    throw new Error(
      'Telegram bot token is missing. Please check your environment variables.'
    )
  }

  // Primary verification method: Use Telegram user ID (most accurate)
  if (telegramUserId) {
    console.log('Using Telegram user ID for verification')
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${
          process.env.TELEGRAM_BOT_TOKEN
        }/getChatMember?chat_id=${encodeURIComponent(
          telegramChatId
        )}&user_id=${telegramUserId}`,
        {
          method: 'GET',
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.ok && data.result) {
          const memberStatus = data.result.status
          const isActive = ['creator', 'administrator', 'member'].includes(
            memberStatus
          )

          console.log(
            `User with ID ${telegramUserId} membership status in ${telegramChatId}: ${memberStatus}`
          )
          return isActive
        }
      }

      if (response.status === 400) {
        console.log(
          `User with ID ${telegramUserId} is NOT a member of ${telegramChatId}`
        )
        return false
      }

      console.error('Telegram API error:', response.status, response.statusText)
      return false
    } catch (error) {
      console.error('Error verifying Telegram membership with ID:', error)
      return false
    }
  }

  // Fallback verification method: Search by username (less reliable)
  console.log('Using username-based verification as fallback')
  try {
    // For username-based verification, we need to get chat administrators and members
    // Note: This is limited and may not work for large groups due to Telegram API restrictions
    const response = await fetch(
      `https://api.telegram.org/bot${
        process.env.TELEGRAM_BOT_TOKEN
      }/getChatAdministrators?chat_id=${encodeURIComponent(telegramChatId)}`,
      {
        method: 'GET',
      }
    )

    if (!response.ok) {
      console.error('Telegram API error:', response.status, response.statusText)
      return false
    }

    const data = await response.json()
    if (!data.ok || !Array.isArray(data.result)) {
      console.log(
        `Could not verify membership for username "${telegramUsername}"`
      )
      return false
    }

    // Check if user is among administrators (this is what we can reliably check)
    const usernameMatch = data.result.some((member: any) => {
      const memberUsername = member.user?.username
      return memberUsername === telegramUsername
    })

    console.log(
      `Username verification result: ${
        usernameMatch
          ? 'User found as admin'
          : 'User not found as admin (may still be a member)'
      }`
    )

    // Note: This method only checks administrators, not all members
    // For better verification, users should connect their Telegram account
    return usernameMatch
  } catch (error) {
    console.error('Error verifying Telegram membership with username:', error)
    return false
  }
}
