// Test script to simulate campaign creation with Telegram task
console.log('🧪 Testing campaign creation with Telegram task...')

const testCampaignData = {
  title: 'Test Campaign',
  description: 'Test campaign with Telegram task',
  longDescription:
    'This is a test campaign to verify Telegram task metadata storage',
  startDate: new Date(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  tasks: [
    {
      id: '1',
      type: 'JOIN_TELEGRAM',
      description: 'Join our Telegram channel',
      verificationData: '@testchannel',
      telegramInviteLink: 'https://t.me/testchannel',
    },
  ],
  reward: {
    type: 'None',
    tokenAddress: '',
    name: 'No reward',
  },
}

console.log('📋 Test campaign data:', JSON.stringify(testCampaignData, null, 2))

// Test the task processing logic
const task = testCampaignData.tasks[0]
console.log('🔍 Task type:', task.type)
console.log('🔍 Task type === JOIN_TELEGRAM:', task.type === 'JOIN_TELEGRAM')
console.log('🔍 Has verificationData:', !!task.verificationData)
console.log('🔍 Has telegramInviteLink:', !!task.telegramInviteLink)
console.log(
  '🔍 Combined condition:',
  task.type === 'JOIN_TELEGRAM' &&
    (task.verificationData || task.telegramInviteLink)
)

if (
  task.type === 'JOIN_TELEGRAM' &&
  (task.verificationData || task.telegramInviteLink)
) {
  console.log('✅ Telegram task condition would pass')
  console.log('📤 Would send metadata:', {
    campaignId: 'test-campaign-id',
    taskIndex: 0,
    taskType: task.type,
    telegramChatId: task.verificationData,
    telegramInviteLink: task.telegramInviteLink,
  })
} else {
  console.log('❌ Telegram task condition would fail')
}
