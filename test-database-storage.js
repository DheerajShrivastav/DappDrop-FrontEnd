// Manual test to verify database operations work
console.log('🧪 Testing database operations...')

async function testDatabase() {
  try {
    // Test storing Telegram metadata directly
    const testResponse = await fetch('http://localhost:3000/api/campaign-task-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaignId: 'test-123',
        taskIndex: 0,
        taskType: 'JOIN_TELEGRAM',
        telegramInviteLink: 'https://t.me/testchannel',
        telegramChatId: '@testchannel',
      }),
    })

    if (testResponse.ok) {
      const result = await testResponse.json()
      console.log('✅ Test storage successful:', result)
      
      // Now test retrieval
      const debugResponse = await fetch('http://localhost:3000/api/debug-metadata?campaignId=test-123')
      if (debugResponse.ok) {
        const debugResult = await debugResponse.json()
        console.log('🔍 Test retrieval successful:', debugResult)
      } else {
        console.error('❌ Test retrieval failed:', await debugResponse.text())
      }
    } else {
      console.error('❌ Test storage failed:', await testResponse.text())
    }
  } catch (error) {
    console.error('❌ Test error:', error)
  }
}

// Run test after a short delay to ensure server is ready
setTimeout(testDatabase, 2000)