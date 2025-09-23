// Telegram utility functions for verification

export interface TelegramVerificationData {
  username?: string
  userId?: string
  chatId: string
}

/**
 * Validate Telegram username format
 */
export function isValidTelegramUsername(username: string): boolean {
  // Telegram usernames are 5-32 characters, alphanumeric + underscores
  // No spaces, start with letter
  const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/
  return usernameRegex.test(username)
}

/**
 * Validate Telegram user ID format
 */
export function isValidTelegramUserId(userId: string): boolean {
  // Telegram user IDs are positive integers
  const userIdRegex = /^\d+$/
  return userIdRegex.test(userId) && parseInt(userId) > 0
}

/**
 * Clean and format Telegram username (remove @ if present)
 */
export function formatTelegramUsername(username: string): string {
  return username.replace(/^@/, '').trim()
}

/**
 * Extract chat ID from Telegram invite link
 */
export function extractChatIdFromInviteLink(inviteLink: string): string | null {
  // Handle different Telegram invite link formats
  const patterns = [
    /t\.me\/joinchat\/([A-Za-z0-9_-]+)/, // Old format
    /t\.me\/\+([A-Za-z0-9_-]+)/, // New format with +
    /t\.me\/([A-Za-z0-9_-]+)/, // Direct username/channel
  ]

  for (const pattern of patterns) {
    const match = inviteLink.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

/**
 * Validate Telegram chat ID format
 */
export function isValidTelegramChatId(chatId: string): boolean {
  // Chat IDs can be negative (groups/channels) or positive (users)
  const chatIdRegex = /^-?\d+$/
  return chatIdRegex.test(chatId)
}

/**
 * Get user-friendly error messages for Telegram verification
 */
export function getTelegramErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    user_not_found:
      'User not found in the Telegram channel/group. Please make sure you have joined.',
    invalid_username:
      'Invalid Telegram username format. Please check your username.',
    invalid_user_id:
      'Invalid Telegram user ID format. Please provide a valid numeric ID.',
    chat_not_found:
      'Telegram channel/group not found. Please contact the campaign organizer.',
    bot_not_member:
      'Verification bot is not a member of the channel/group. Please contact support.',
    insufficient_permissions:
      'Bot does not have permission to check membership. Please contact support.',
  }

  return (
    errorMessages[error] ||
    'An unexpected error occurred during verification. Please try again.'
  )
}
