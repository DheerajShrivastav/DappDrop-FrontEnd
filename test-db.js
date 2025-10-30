// Test script to verify database operations
import { prisma } from '../src/lib/prisma'

async function testDatabaseOperations() {
  try {
    console.log('🔍 Testing database operations...')

    // Test creating a Telegram task metadata entry
    const testData = {
      campaignId: 'test-123',
      taskIndex: 0,
      taskType: 'JOIN_TELEGRAM',
      telegramInviteLink: 'https://t.me/testchannel',
      telegramChatId: '@testchannel',
    }

    console.log('📝 Creating test entry:', testData)

    const created = await prisma.campaignTaskMetadata.create({
      data: testData,
    })

    console.log('✅ Created:', created)

    // Test querying the entry
    const found = await prisma.campaignTaskMetadata.findFirst({
      where: {
        campaignId: testData.campaignId,
        taskIndex: testData.taskIndex,
      },
    })

    console.log('🔍 Found:', found)

    // Test upsert operation
    const upserted = await prisma.campaignTaskMetadata.upsert({
      where: {
        campaignId_taskIndex: {
          campaignId: testData.campaignId,
          taskIndex: testData.taskIndex,
        },
      },
      update: {
        telegramChatId: '@updatedchannel',
      },
      create: testData,
    })

    console.log('🔄 Upserted:', upserted)

    // Clean up
    await prisma.campaignTaskMetadata.delete({
      where: {
        id: created.id,
      },
    })

    console.log('🗑️ Cleaned up test data')
    console.log('✅ All database operations working correctly!')
  } catch (error) {
    console.error('❌ Database test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testDatabaseOperations().catch(console.error)
