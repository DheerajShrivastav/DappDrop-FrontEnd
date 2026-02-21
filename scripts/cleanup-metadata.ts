
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🧹 Cleaning up invalid CampaignTaskMetadata...')

    // Fetch all records
    const allRecords = await prisma.campaignTaskMetadata.findMany()
    console.log(`Found ${allRecords.length} records.`)

    let deletedCount = 0

    for (const record of allRecords) {
        const campaignIdStr = record.campaignId as unknown as string
        const campaignIdNum = parseInt(campaignIdStr, 10)

        // Check if it's NOT a valid number OR if the parsed number doesn't match the string (e.g. "123-abc")
        if (isNaN(campaignIdNum) || campaignIdNum.toString() !== campaignIdStr) {
            console.log(`Deleting invalid record: campaignId="${campaignIdStr}" (ID: ${record.id})`)
            await prisma.campaignTaskMetadata.delete({
                where: { id: record.id }
            })
            deletedCount++
        }
    }

    console.log(`✅ Cleanup complete. Deleted ${deletedCount} invalid records.`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
