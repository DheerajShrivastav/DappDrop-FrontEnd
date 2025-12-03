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
    `Verifying if user "${discordUsername}" (ID: ${discordId || 'unknown'
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
      `Username verification result: ${usernameMatch ? 'User found in server' : 'User not found in server'
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
 * 3. Supporting user ID-based verification (username verification requires additional steps)
 * 4. Providing accurate membership verification for campaign tasks
 *
 * @param telegramUsername - The Telegram username of the participant (without @)
 * @param telegramChatId - The Telegram channel/group chat ID (e.g., @channelname or -100123456789)
 * @param telegramUserId - Required Telegram user ID for accurate verification
 * @returns Promise<boolean> - true if user is verified as a channel/group member, false otherwise
 * @throws Error if Telegram bot token is not configured or required parameters are missing
 */
export const verifyTelegramJoin = async (
  telegramUsername: string,
  telegramChatId: string,
  telegramUserId?: string
): Promise<boolean> => {
  console.log(
    `Verifying if user "${telegramUsername}" (ID: ${telegramUserId || 'unknown'
    }) joined Telegram channel/group ${telegramChatId}`
  )

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('Telegram bot token is not configured')
    throw new Error(
      'Telegram bot token is missing. Please check your environment variables.'
    )
  }

  // Primary verification method: Use Telegram user ID (most accurate and correct)
  if (telegramUserId) {
    console.log('Using Telegram user ID for verification')

    // Retry logic for network issues
    const maxRetries = 3
    const retryDelay = 2000 // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}: Calling Telegram API...`)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        const response = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${telegramChatId}&user_id=${telegramUserId}`,
          {
            method: 'GET',
            signal: controller.signal,

          }
        )

        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          console.log('Telegram API response:', JSON.stringify(data, null, 2))

          if (data.ok && data.result) {
            const memberStatus = data.result.status
            // Valid member statuses: creator, administrator, member
            // Invalid statuses: left, kicked
            const isActive = ['creator', 'administrator', 'member'].includes(
              memberStatus
            )

            console.log(
              `User with ID ${telegramUserId} membership status in ${telegramChatId}: ${memberStatus} (Active: ${isActive})`
            )
            return isActive
          } else {
            console.log('Telegram API returned invalid result:', data)
            return false
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.log('Telegram API error response:', errorData)

          if (response.status === 400) {
            // Bad request - likely user not found or not a member
            console.log(
              `User with ID ${telegramUserId} is NOT a member of ${telegramChatId} (HTTP 400)`
            )
            return false
          }

          if (response.status === 403) {
            // Forbidden - bot doesn't have access or user privacy settings
            console.log(
              `Bot doesn't have access to check user ${telegramUserId} in ${telegramChatId} (HTTP 403)`
            )
            return false
          }

          // For other HTTP errors, don't retry
          if (response.status >= 400 && response.status < 500) {
            console.error(
              'Telegram API client error:',
              response.status,
              response.statusText
            )
            return false
          }

          // For server errors (5xx), retry
          console.error(
            `Telegram API server error (attempt ${attempt}):`,
            response.status,
            response.statusText
          )
          if (attempt === maxRetries) {
            return false
          }
        }
      } catch (error) {
        console.error(
          `Error verifying Telegram membership (attempt ${attempt}):`,
          error
        )

        // Type guard for error handling
        const isNetworkError = (
          err: unknown
        ): err is Error & { code?: string; name?: string } => {
          return err instanceof Error
        }

        // Check if it's a network timeout or connection error
        if (
          isNetworkError(error) &&
          (error.name === 'AbortError' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||
            error.message.includes('fetch failed'))
        ) {
          console.log('Network issue detected:', error.message)
          if (attempt < maxRetries) {
            console.log(`Retrying in ${retryDelay}ms...`)
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
            continue
          } else {
            console.error('Max retries reached, network issue persists')
            throw new Error(
              'Network timeout: Unable to reach Telegram API after multiple attempts. Please check your internet connection and try again.'
            )
          }
        }

        // For other errors, don't retry
        const errorMessage = isNetworkError(error)
          ? error.message
          : 'Unknown error occurred'
        throw new Error(`Telegram verification failed: ${errorMessage}`)
      }
    }

    return false
  }

  // Fallback: Username-only verification (limited by Telegram Bot API)
  console.log(
    '⚠️ No user ID provided - username-only verification has limitations'
  )

  // The getChatMember API requires a numeric user ID, not username
  // We can only check administrators list for username verification
  try {
    const adminResponse = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN
      }/getChatAdministrators?chat_id=${encodeURIComponent(telegramChatId)}`,
      {
        method: 'GET',
      }
    )

    if (adminResponse.ok) {
      const adminData = await adminResponse.json()
      console.log('Admin list response:', JSON.stringify(adminData, null, 2))

      if (adminData.ok && Array.isArray(adminData.result)) {
        // Check if user is among administrators
        const adminMatch = adminData.result.some((member: any) => {
          const memberUsername = member.user?.username
          return memberUsername === telegramUsername
        })

        if (adminMatch) {
          console.log(
            `User ${telegramUsername} found as admin in ${telegramChatId}`
          )
          return true
        }
      }
    }

    // For regular members without user ID, we cannot reliably verify
    // Telegram Bot API limitations prevent checking regular members by username
    console.log(
      `⚠️ Cannot verify regular member "${telegramUsername}" without user ID. Telegram Bot API requires numeric user ID for getChatMember.`
    )

    // Ask user to provide their user ID for proper verification
    throw new Error(
      'Username-only verification is limited. Please provide your Telegram user ID for accurate verification. You can get your ID by messaging @userinfobot on Telegram.'
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('user ID')) {
      throw error // Re-throw our custom error about needing user ID
    }
    console.error('Error verifying Telegram membership with username:', error)
    return false
  }
}

/**
 * Helper function to get Telegram user ID from username
 * This can be used to improve verification accuracy
 */
export const getTelegramUserIdFromUsername = async (
  telegramUsername: string,
  telegramChatId: string
): Promise<string | null> => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return null
  }

  try {
    // Try to get user info by checking recent messages or members
    const adminResponse = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN
      }/getChatAdministrators?chat_id=${encodeURIComponent(telegramChatId)}`,
      {
        method: 'GET',
      }
    )

    if (adminResponse.ok) {
      const adminData = await adminResponse.json()
      if (adminData.ok && Array.isArray(adminData.result)) {
        const member = adminData.result.find((member: any) => {
          return member.user?.username === telegramUsername
        })

        if (member && member.user?.id) {
          return member.user.id.toString()
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error getting Telegram user ID:', error)
    return null
  }
}

/**
 * Enhanced Telegram verification that tries to get user ID first
 */
export const verifyTelegramJoinEnhanced = async (
  telegramUsername: string,
  telegramChatId: string
): Promise<boolean> => {
  // First try to get user ID from username
  const userId = await getTelegramUserIdFromUsername(
    telegramUsername,
    telegramChatId
  )

  if (userId) {
    console.log(`Found user ID ${userId} for username ${telegramUsername}`)
    return verifyTelegramJoin(telegramUsername, telegramChatId, userId)
  }

  // Fallback to username-only verification
  return verifyTelegramJoin(telegramUsername, telegramChatId)
}
