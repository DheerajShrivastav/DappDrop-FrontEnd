// Simple Telegram integration helper for campaign creation
// This file contains the logic to store Telegram metadata when creating campaigns

import { TaskType } from '@/lib/types'

interface TelegramTaskData {
  type: TaskType
  telegramInviteLink?: string
  telegramChatId?: string
}

/**
 * Store Telegram metadata for a campaign task
 */
export async function storeTelegramMetadata(
  campaignId: string,
  taskIndex: number,
  taskData: TelegramTaskData
): Promise<boolean> {
  try {
    if (taskData.type !== 'JOIN_TELEGRAM') {
      return false
    }

    if (!taskData.telegramInviteLink && !taskData.telegramChatId) {
      console.warn('No Telegram metadata to store')
      return false
    }

    const response = await fetch('/api/campaign-task-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaignId: campaignId,
        taskIndex: taskIndex,
        taskType: taskData.type,
        telegramInviteLink: taskData.telegramInviteLink,
        telegramChatId: taskData.telegramChatId,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to store metadata: ${response.statusText}`)
    }

    console.log(
      'Successfully stored Telegram metadata for campaign:',
      campaignId
    )
    return true
  } catch (error) {
    console.error('Failed to store Telegram metadata:', error)
    return false
  }
}

/**
 * Process all Telegram tasks in a campaign and store their metadata
 */
export async function processAndStoreTelegramTasks(
  campaignId: string,
  tasks: any[]
): Promise<void> {
  for (const [index, task] of tasks.entries()) {
    if (task.type === 'JOIN_TELEGRAM') {
      await storeTelegramMetadata(campaignId, index, task)
    }
  }
}
