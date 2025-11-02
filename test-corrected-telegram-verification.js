// Test script to verify the corrected Telegram verification implementation

import { verifyTelegramJoin } from './src/lib/verification-service.ts'

async function testCorrectedTelegramVerification() {
  console.log('🧪 Testing corrected Telegram verification implementation...\n')

  // Test bot connectivity first
  const TELEGRAM_BOT_TOKEN =
    process.env.TELEGRAM_BOT_TOKEN ||
    '7950005519:AAE81VpT9ktFdwky-y_E1jVgpZdQA741HTE'

  try {
    console.log('1. Testing bot connectivity...')
    const botResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
    )
    const botInfo = await botResponse.json()

    if (botInfo.ok) {
      console.log(`✅ Bot connected: @${botInfo.result.username}`)
    } else {
      console.log('❌ Bot connection failed:', botInfo)
      return
    }

    // Test 2: Verify with correct user ID format
    console.log('\n2. Testing getChatMember with correct user ID...')

    // Test with a known user ID (Telegram founder Pavel Durov's public ID as example)
    const testUserId = '777000' // System user ID
    const testChatId = '@durov' // Public channel

    console.log(`Testing getChatMember API call format:`)
    console.log(
      `URL: https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember`
    )
    console.log(`Parameters: chat_id=${testChatId}, user_id=${testUserId}`)

    const apiResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(
        testChatId
      )}&user_id=${testUserId}`
    )
    const apiResult = await apiResponse.json()

    console.log('API Response:', JSON.stringify(apiResult, null, 2))

    if (apiResult.ok) {
      console.log(`✅ getChatMember API call successful`)
      console.log(`Member status: ${apiResult.result.status}`)
    } else {
      console.log(
        `⚠️ API call response: ${apiResult.description || 'Unknown error'}`
      )
    }

    // Test 3: Test with invalid user ID format (old implementation)
    console.log(
      '\n3. Testing with invalid user ID format (demonstrating the problem)...'
    )

    const invalidResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(
        testChatId
      )}&user_id=@someusername`
    )
    const invalidResult = await invalidResponse.json()

    console.log(
      'Invalid format response:',
      JSON.stringify(invalidResult, null, 2)
    )

    // Test 4: Use our corrected verification function
    console.log('\n4. Testing corrected verification function...')

    try {
      const verificationResult = await verifyTelegramJoin(
        'testuser',
        '@durov',
        testUserId
      )
      console.log(`✅ Verification function result: ${verificationResult}`)
    } catch (error) {
      console.log(`Function error: ${error.message}`)
    }

    // Test 5: Test without user ID (should give helpful error)
    console.log('\n5. Testing without user ID (should require user ID)...')

    try {
      const noIdResult = await verifyTelegramJoin(
        'testuser',
        '@durov'
        // No user ID provided
      )
      console.log(`Without ID result: ${noIdResult}`)
    } catch (error) {
      console.log(`Expected error: ${error.message}`)
    }
  } catch (error) {
    console.error('Test error:', error)
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  testCorrectedTelegramVerification()
}

export { testCorrectedTelegramVerification }
