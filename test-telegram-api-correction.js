// Test script to verify the corrected Telegram verification API calls

async function testTelegramAPI() {
  console.log('🧪 Testing corrected Telegram getChatMember API...\n')

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

    // Test 2: Test getChatMember with correct user ID format
    console.log('\n2. Testing getChatMember with correct numeric user ID...')

    // Use a known public user ID (Telegram's official channel)
    const testUserId = '777000' // System notifications user ID
    const testChatId = '@telegram' // Official Telegram channel

    console.log(`API call: getChatMember`)
    console.log(`chat_id: ${testChatId}`)
    console.log(`user_id: ${testUserId} (numeric)`)

    const correctResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(
        testChatId
      )}&user_id=${testUserId}`
    )
    const correctResult = await correctResponse.json()

    console.log(
      '✅ Correct format response:',
      JSON.stringify(correctResult, null, 2)
    )

    // Test 3: Test with incorrect format (what was wrong before)
    console.log('\n3. Testing with INCORRECT format (old implementation)...')

    console.log(`API call: getChatMember`)
    console.log(`chat_id: ${testChatId}`)
    console.log(`user_id: @someusername (WRONG - should be numeric)`)

    const incorrectResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(
        testChatId
      )}&user_id=@someusername`
    )
    const incorrectResult = await incorrectResponse.json()

    console.log(
      '❌ Incorrect format response:',
      JSON.stringify(incorrectResult, null, 2)
    )

    // Test 4: Test getChatAdministrators (this works for checking admins)
    console.log(
      '\n4. Testing getChatAdministrators (for username verification)...'
    )

    const adminResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatAdministrators?chat_id=${encodeURIComponent(
        testChatId
      )}`
    )
    const adminResult = await adminResponse.json()

    if (adminResult.ok) {
      console.log(
        `✅ getChatAdministrators works, found ${adminResult.result.length} admins`
      )
      console.log(
        'First admin example:',
        JSON.stringify(adminResult.result[0], null, 2)
      )
    } else {
      console.log('❌ getChatAdministrators failed:', adminResult)
    }

    // Test 5: Manual verification logic implementation
    console.log('\n5. Testing verification logic...')

    const testVerifyUserId = '12345678' // Example user ID
    const testVerifyChatId = '@testchannel'

    console.log(
      `Verifying user ID ${testVerifyUserId} in ${testVerifyChatId}...`
    )

    const verifyResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(
        testVerifyChatId
      )}&user_id=${testVerifyUserId}`
    )
    const verifyResult = await verifyResponse.json()

    console.log('Verification response:', JSON.stringify(verifyResult, null, 2))

    if (verifyResult.ok && verifyResult.result) {
      const status = verifyResult.result.status
      const isActive = ['creator', 'administrator', 'member'].includes(status)
      console.log(`User status: ${status}, Is active member: ${isActive}`)
    } else {
      console.log(
        `User not found or error: ${verifyResult.description || 'Unknown'}`
      )
    }

    console.log('\n📋 Summary:')
    console.log('✅ Correct API usage: user_id must be numeric (user ID)')
    console.log('❌ Incorrect API usage: user_id cannot be @username')
    console.log(
      '💡 For username verification: use getChatAdministrators to check admins only'
    )
    console.log('💡 For regular members: user ID is required')
  } catch (error) {
    console.error('Test error:', error)
  }
}

testTelegramAPI()
