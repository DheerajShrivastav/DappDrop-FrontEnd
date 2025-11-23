import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ethers } from 'ethers'
import config from '@/app/config'
import Web3Campaigns from '@/lib/abi/Web3Campaigns.json'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    // Await params in Next.js 15
    const resolvedParams = await params
    const campaignIdString = resolvedParams.campaignId

    console.log(
      '📥 Image save request received for campaign:',
      campaignIdString
    )

    // Parse request body
    const { imageUrl, userAddress } = await request.json()

    console.log('📥 Request data:', { imageUrl, userAddress })

    // Authenticate user (require wallet address)
    if (!userAddress || typeof userAddress !== 'string') {
      console.error('❌ Missing or invalid userAddress')
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 401 }
      )
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('❌ Missing or invalid imageUrl')
      return NextResponse.json(
        { error: 'imageUrl is required and must be a string' },
        { status: 400 }
      )
    }

    const campaignId = parseInt(campaignIdString)

    if (isNaN(campaignId)) {
      console.error('❌ Invalid campaignId:', campaignIdString)
      return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
    }

    console.log('🔍 Looking for campaign cache with campaignId:', campaignId)

    // Check if campaign cache exists
    let existingCache = await prisma.campaignCache.findFirst({
      where: { campaignId },
    })

    console.log(
      '🔍 Cache lookup result:',
      existingCache ? 'Found' : 'Not found'
    )

    // If cache doesn't exist, we need to create it by fetching from blockchain
    if (!existingCache) {
      console.log(
        `📡 Campaign cache not found for ${campaignId}, fetching from blockchain...`
      )

      try {
        // Fetch campaign data from blockchain
        const provider = new ethers.JsonRpcProvider(
          'https://ethereum-sepolia.publicnode.com'
        )
        const contract = new ethers.Contract(
          config.campaignFactoryAddress!,
          Web3Campaigns.abi,
          provider
        )

        const onChainData = await contract.getCampaign(campaignId)

        // Verify that the user is the campaign host
        if (onChainData.host.toLowerCase() !== userAddress.toLowerCase()) {
          console.error('❌ User is not campaign host:', {
            user: userAddress.toLowerCase(),
            host: onChainData.host.toLowerCase(),
          })
          return NextResponse.json(
            { error: 'Only the campaign host can update the image' },
            { status: 403 }
          )
        }

        console.log('✅ Creating campaign cache with data:', {
          campaignId,
          contractAddress: config.campaignFactoryAddress,
          title: onChainData.name,
          hostAddress: onChainData.host,
          isActive: Number(onChainData.status) === 1,
        })

        // Create campaign cache entry
        existingCache = await prisma.campaignCache.create({
          data: {
            campaignId,
            contractAddress: config.campaignFactoryAddress!,
            title: onChainData.name || `Campaign ${campaignId}`,
            description: `Campaign hosted by ${onChainData.host}`,
            hostAddress: onChainData.host,
            isActive: Number(onChainData.status) === 1, // 1 = Open status
            imageUrl,
            tags: [],
            lastSyncedAt: new Date(),
          },
        })

        console.log(
          `✅ Created campaign cache for ${campaignId}:`,
          existingCache.id
        )
      } catch (blockchainError: any) {
        console.error('❌ Error fetching campaign from blockchain:', {
          error: blockchainError.message,
          code: blockchainError.code,
          campaignId,
        })
        return NextResponse.json(
          {
            error:
              'Failed to fetch campaign from blockchain. Please ensure the campaign exists.',
            details: blockchainError.message,
          },
          { status: 404 }
        )
      }
    } else {
      console.log('✅ Campaign cache exists, updating...')
      // Verify that the user is the campaign host
      if (
        existingCache.hostAddress.toLowerCase() !== userAddress.toLowerCase()
      ) {
        console.error('❌ User is not campaign host:', {
          user: userAddress.toLowerCase(),
          host: existingCache.hostAddress.toLowerCase(),
        })
        return NextResponse.json(
          { error: 'Only the campaign host can update the image' },
          { status: 403 }
        )
      }

      // Update imageUrl in database
      existingCache = await prisma.campaignCache.update({
        where: { id: existingCache.id },
        data: {
          imageUrl,
          lastSyncedAt: new Date(),
        },
      })

      console.log('✅ Updated campaign cache image URL')
    }

    console.log('✅ Image save successful for campaign:', campaignId)

    return NextResponse.json({
      success: true,
      campaignId: existingCache.campaignId,
      imageUrl: existingCache.imageUrl,
    })
  } catch (error: any) {
    console.error('❌ Error updating campaign image:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve campaign image
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const resolvedParams = await params
    const campaignId = parseInt(resolvedParams.campaignId)

    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
    }

    const campaign = await prisma.campaignCache.findFirst({
      where: { campaignId },
      select: {
        campaignId: true,
        imageUrl: true,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({
      campaignId: campaign.campaignId,
      imageUrl: campaign.imageUrl,
    })
  } catch (error) {
    console.error('Error fetching campaign image:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
