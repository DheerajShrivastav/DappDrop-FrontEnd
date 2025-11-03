// Test simplified verify-task route

async function testSimplifiedRoute() {
  console.log('🧪 Testing simplified /api/verify-task route...\n')

  const testCases = [
    {
      name: 'Discord verification',
      data: {
        campaignId: 'test-campaign',
        taskId: '0',
        userAddress: '0x1234567890abcdef',
        discordUsername: 'testuser#1234',
        discordId: '123456789'
      }
    },
    {
      name: 'Telegram verification',
      data: {
        campaignId: 'test-campaign',
        taskId: '1',
        userAddress: '0x1234567890abcdef',
        telegramUsername: 'testuser',
        telegramUserId: '987654321'
      }
    },
    {
      name: 'Minimal request',
      data: {
        campaignId: 'test',
        taskId: '0',
        userAddress: '0x123'
      }
    }
  ]

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`)
    console.log('Request body:', JSON.stringify(testCase.data, null, 2))
    
    try {
      const response = await fetch('http://localhost:3000/api/verify-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.data)
      })

      const result = await response.json()
      
      console.log(`Status: ${response.status}`)
      console.log('Response:', JSON.stringify(result, null, 2))
      console.log('---\n')
      
    } catch (error) {
      console.log(`Error: ${error.message}`)
      console.log('---\n')
    }
  }
}

// Wait a bit for the server to be ready
setTimeout(testSimplifiedRoute, 3000)