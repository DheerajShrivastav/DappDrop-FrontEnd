// Quick test script to verify Telegram bot functionality

async function testTelegramBot() {
  const TELEGRAM_BOT_TOKEN =
    process.env.TELEGRAM_BOT_TOKEN 

  console.log('🤖 Testing Telegram Bot...')

  try {
    // Test 1: Get bot info
    console.log('\n1. Testing bot info...')
    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
    )
    const botInfo = await botInfoResponse.json()

    if (botInfo.ok) {
      console.log('✅ Bot is working!')
      console.log(`Bot Name: ${botInfo.result.username}`)
      console.log(`Bot ID: ${botInfo.result.id}`)
    } else {
      console.log('❌ Bot info failed:', botInfo)
      return
    }

    // Test 2: Test with a sample channel (you can replace with your test channel)
    console.log('\n2. Testing chat membership check...')
    const testChatId = '@your_test_channel' // Replace with your test channel
    const testUserId = '123456789' // Replace with a real user ID for testing

    const memberResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(
        testChatId
      )}&user_id=${testUserId}`
    )
    const memberData = await memberResponse.json()

    console.log('Chat member check result:', memberData)

    // Test 3: Test with getting chat administrators
    console.log('\n3. Testing chat administrators...')
    const adminResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatAdministrators?chat_id=${encodeURIComponent(
        testChatId
      )}`
    )
    const adminData = await adminResponse.json()

    if (adminData.ok) {
      console.log('✅ Can get chat administrators')
      console.log(`Found ${adminData.result.length} administrators`)
    } else {
      console.log('❌ Cannot get chat administrators:', adminData)
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testTelegramBot()
