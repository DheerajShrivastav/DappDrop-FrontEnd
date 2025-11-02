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
      // Store Discord metadata
      if (task.type === 'JOIN_DISCORD' && task.discordInviteLink) {
        console.log('💙 Storing Discord metadata...')
        const response = await fetch('/api/campaign-task-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            campaignId: campaignId,
            taskIndex: index,
            taskType: task.type,
            discordInviteLink: task.discordInviteLink,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('❌ API Error for Discord metadata:', errorData)
        } else {
          console.log('✅ Stored Discord metadata for task', index)
        }
      }

      // Store Telegram metadata
      if (task.type === 'JOIN_TELEGRAM') {
        console.log('📱 Found Telegram task, checking metadata...')
        console.log('📱 Telegram fields:', {
          verificationData: task.verificationData, // This is the chat ID
          telegramInviteLink: task.telegramInviteLink,
        })

        if (task.telegramInviteLink || task.verificationData) {
          console.log('📤 Sending Telegram metadata to API...')

          const requestBody = {
            campaignId: campaignId,
            taskIndex: index,
            taskType: task.type,
            telegramInviteLink: task.telegramInviteLink,
            telegramChatId: task.verificationData, // The form stores chat ID in verificationData
          }

          console.log('📤 Request body:', JSON.stringify(requestBody, null, 2))

          const response = await fetch('/api/campaign-task-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error('❌ API Error for Telegram metadata:', errorData)
            throw new Error(`API Error: ${errorData.error}`)
          }

          const result = await response.json()
          console.log('✅ Stored Telegram metadata for task', index, result)
        } else {
          console.warn(
            '⚠️ Telegram task found but no invite link or chat ID provided'
          )
        }
      }
    } catch (error) {
      console.error(`❌ Failed to store metadata for task ${index}:`, error)
    }
  }
}
