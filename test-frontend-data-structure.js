// Test script to simulate frontend campaign creation
// This mimics the exact data structure sent from the create-campaign form

const testCampaignData = {
  title: 'Test Telegram Campaign',
  shortDescription: 'This is a test campaign for Telegram task storage',
  description:
    'This is a longer description of the test campaign to verify Telegram task metadata storage',
  dates: {
    from: new Date(),
    to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  },
  tasks: [
    {
      type: 'JOIN_TELEGRAM',
      description: 'Join our Telegram channel',
      verificationData: '@testchannel123',
      telegramInviteLink: 'https://t.me/testchannel123',
    },
  ],
  reward: {
    type: 'None',
    tokenAddress: '',
    amount: '',
    name: 'No Reward',
  },
}

console.log('🧪 Test Campaign Data Structure:')
console.log(JSON.stringify(testCampaignData, null, 2))

console.log('\n🔍 Task Analysis:')
const task = testCampaignData.tasks[0]
console.log('Task type:', task.type)
console.log('Task type === JOIN_TELEGRAM:', task.type === 'JOIN_TELEGRAM')
console.log('Has verificationData:', !!task.verificationData)
console.log('Has telegramInviteLink:', !!task.telegramInviteLink)
console.log(
  'Storage condition would pass:',
  task.type === 'JOIN_TELEGRAM' &&
    (task.verificationData || task.telegramInviteLink)
)
