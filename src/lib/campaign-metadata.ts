// Store task metadata after campaign creation
export async function storeCampaignTaskMetadata(
  campaignId: string,
  tasks: any[]
) {
  console.log('🚀 === STARTING METADATA STORAGE ===')
  console.log('🏁 Campaign ID:', campaignId)
  console.log('📋 Number of tasks:', tasks.length)
  console.log('📋 Full tasks array:', JSON.stringify(tasks, null, 2))

  if (!tasks || tasks.length === 0) {
    console.warn('⚠️ No tasks provided to store')
    return
  }

  for (const [index, task] of tasks.entries()) {
    console.log(`🔄 Processing task ${index}:`, task)

    try {
      // Prepare metadata object
      const metadata: any = {
        campaignId: campaignId,
        taskIndex: index,
        taskType: task.type,
        requiresHumanityVerification: task.requiresHumanityVerification || false,
      }

      // Add Discord-specific metadata
      if (task.type === 'JOIN_DISCORD' && task.discordInviteLink) {
        console.log('💙 Including Discord metadata...')
        metadata.discordInviteLink = task.discordInviteLink
      }

      // Add Telegram-specific metadata
      if (task.type === 'JOIN_TELEGRAM') {
        console.log('📱 Found Telegram task, checking metadata...')
        if (task.telegramInviteLink || task.verificationData) {
          console.log('📱 Including Telegram metadata...')
          metadata.telegramInviteLink = task.telegramInviteLink
          metadata.telegramChatId = task.verificationData // The form stores chat ID in verificationData
        } else {
          console.warn(
            '⚠️ Telegram task found but no invite link or chat ID provided'
          )
        }
      }

      // Store metadata if there's anything to store
      if (
        task.discordInviteLink ||
        task.telegramInviteLink ||
        task.verificationData ||
        task.requiresHumanityVerification
      ) {
        console.log('📤 Storing task metadata:', metadata)
        
        const response = await fetch('/api/campaign-task-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('❌ API Error for task metadata:', errorData)
          throw new Error(`API Error: ${errorData.error}`)
        }

        const result = await response.json()
        console.log('✅ Stored metadata for task', index, result)
      }
    } catch (error) {
      console.error(`❌ Failed to store metadata for task ${index}:`, error)
    }
  }
}
