import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ethers } from 'ethers'
import config from '@/app/config'
import Web3Campaigns from '@/lib/abi/Web3Campaigns.json'
import { UTApi } from 'uploadthing/server'
import { extractFileKeyFromUrl } from '@/lib/uploadthing'
import { verifyAuthentication } from '@/lib/auth-utils'

const utapi = new UTApi()

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
    const { imageUrl, signature, message, shortDescription, longDescription, rewardType, rewardName } = await request.json()

    console.log('📥 Request data received')

    // Authentication: Verify signature to get authenticated address
    if (!signature || !message) {
      console.error('❌ Missing authentication credentials')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the signature and recover the signer's address
    const authenticatedAddress = await verifyAuthentication(signature, message)
    if (!authenticatedAddress) {
      console.error('❌ Authentication failed: Invalid signature')
      return NextResponse.json(
        { error: 'Invalid authentication credentials' },
        { status: 401 }
      )
    }

    console.log('✅ Authenticated user:', authenticatedAddress)

    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('❌ Missing or invalid imageUrl')
      return NextResponse.json(
        { error: 'imageUrl is required and must be a string' },
        { status: 400 }
      )
    }

    // Prepare optional metadata fields
    const metadataFields: Record<string, string | undefined> = {}
    if (shortDescription && typeof shortDescription === 'string') metadataFields.shortDescription = shortDescription
    if (longDescription && typeof longDescription === 'string') metadataFields.longDescription = longDescription
    if (rewardType && typeof rewardType === 'string') metadataFields.rewardType = rewardType
    if (rewardName && typeof rewardName === 'string') metadataFields.rewardName = rewardName

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

        // Authorization: Verify that the authenticated user is the campaign host
        if (
          onChainData.host.toLowerCase() !== authenticatedAddress.toLowerCase()
        ) {
          console.error('❌ Authorization failed: User is not campaign host')
          return NextResponse.json(
            { error: 'Only the campaign host can update the image' },
            { status: 403 }
          )
        }

        console.log('✅ Authorization successful: User is campaign host')

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
            ...metadataFields,
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
          },
          { status: 404 }
        )
      }
    } else {
      console.log('✅ Campaign cache exists, updating...')
      // Authorization: Verify that the authenticated user is the campaign host
      if (
        existingCache.hostAddress.toLowerCase() !==
        authenticatedAddress.toLowerCase()
      ) {
        console.error('❌ Authorization failed: User is not campaign host')
        return NextResponse.json(
          { error: 'Only the campaign host can update the image' },
          { status: 403 }
        )
      }

      console.log('✅ Authorization successful: User is campaign host')

      // Delete old image from UploadThing if it exists and is different from new one
      if (existingCache.imageUrl && existingCache.imageUrl !== imageUrl) {
        try {
          // Extract file key from UploadThing URL
          const oldImageKey = extractFileKeyFromUrl(existingCache.imageUrl)
          if (oldImageKey) {
            console.log('🗑️ Deleting old image:', oldImageKey)
            await utapi.deleteFiles(oldImageKey)
            console.log('✅ Old image deleted successfully')
          }
        } catch (deleteError) {
          // Log error but don't fail the update
          console.warn('⚠️ Failed to delete old image:', deleteError)
        }
      }

      // Update imageUrl and metadata in database
      existingCache = await prisma.campaignCache.update({
        where: { id: existingCache.id },
        data: {
          imageUrl,
          ...metadataFields,
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
        shortDescription: true,
        longDescription: true,
        rewardType: true,
        rewardName: true,
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({
      campaignId: campaign.campaignId,
      imageUrl: campaign.imageUrl,
      shortDescription: campaign.shortDescription,
      longDescription: campaign.longDescription,
      rewardType: campaign.rewardType,
      rewardName: campaign.rewardName,
    })
  } catch (error) {
    console.error('Error fetching campaign image:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE endpoint to remove campaign images
// Requires authentication and authorization - only campaign host can delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const resolvedParams = await params
    const campaignIdString = resolvedParams.campaignId
    const campaignId = parseInt(campaignIdString)

    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 })
    }

    // Parse request body
    const { signature, message } = await request.json()

    // Authentication: Verify signature
    if (!signature || !message) {
      console.error('❌ Missing authentication credentials')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const authenticatedAddress = await verifyAuthentication(signature, message)
    if (!authenticatedAddress) {
      console.error('❌ Authentication failed')
      return NextResponse.json(
        { error: 'Invalid authentication credentials' },
        { status: 401 }
      )
    }

    console.log('🗑️ Authenticated delete request from:', authenticatedAddress)

    // Fetch campaign from database
    const campaign = await prisma.campaignCache.findFirst({
      where: { campaignId },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Authorization: Verify the authenticated user is the campaign host
    if (
      campaign.hostAddress.toLowerCase() !== authenticatedAddress.toLowerCase()
    ) {
      console.error('❌ Authorization failed: User is not campaign host')
      return NextResponse.json(
        { error: 'Only the campaign host can delete campaign images' },
        { status: 403 }
      )
    }

    console.log('✅ Authorization successful')

    // Check if campaign has an image to delete
    if (!campaign.imageUrl) {
      return NextResponse.json(
        { error: 'Campaign has no image to delete' },
        { status: 404 }
      )
    }

    // Extract file key from the stored image URL
    const fileKey = extractFileKeyFromUrl(campaign.imageUrl)
    if (!fileKey) {
      console.error('❌ Invalid image URL format in database')
      return NextResponse.json(
        { error: 'Invalid image URL format' },
        { status: 400 }
      )
    }

    console.log('🗑️ Deleting image:', fileKey)

    // Delete from UploadThing
    try {
      await utapi.deleteFiles(fileKey)
      console.log('✅ Image deleted from storage')

      // Update database to remove image URL
      await prisma.campaignCache.update({
        where: { id: campaign.id },
        data: {
          imageUrl: null,
          lastSyncedAt: new Date(),
        },
      })

      console.log('✅ Image reference removed from database')

      return NextResponse.json({
        success: true,
        message: 'Image deleted successfully',
      })
    } catch (deleteError) {
      console.error('❌ Failed to delete image from storage')
      return NextResponse.json(
        { error: 'Failed to delete image from storage' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ Error in DELETE endpoint')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
