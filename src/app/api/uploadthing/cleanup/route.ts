import { NextRequest, NextResponse } from 'next/server'
import { UTApi } from 'uploadthing/server'
import { extractFileKeyFromUrl } from '@/lib/uploadthing'
import { verifyAuthentication } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

const utapi = new UTApi()

/**
 * POST endpoint to clean up orphaned images
 * Used when campaign creation is cancelled or fails
 * Requires authentication - only the image owner can delete their uploads
 */
export async function POST(request: NextRequest) {
  try {
    const { imageUrl, signature, message, userAddress } = await request.json()

    // Validate required fields
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    // Authentication: Verify the user's wallet signature
    if (!signature || !message || !userAddress) {
      console.error('❌ Missing authentication credentials')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the signature matches the claimed address
    const authenticatedAddress = await verifyAuthentication(signature, message)
    if (
      !authenticatedAddress ||
      authenticatedAddress.toLowerCase() !== userAddress.toLowerCase()
    ) {
      console.error('❌ Authentication failed: Invalid signature')
      return NextResponse.json(
        { error: 'Invalid authentication credentials' },
        { status: 401 }
      )
    }

    console.log('🗑️ Authenticated cleanup request from:', authenticatedAddress)
    console.log('🗑️ Cleanup request for image:', imageUrl)

    // Extract file key from URL
    const fileKey = extractFileKeyFromUrl(imageUrl)
    if (!fileKey) {
      return NextResponse.json(
        { error: 'Invalid UploadThing URL format' },
        { status: 400 }
      )
    }

    // Authorization: Verify the user owns this image
    // Check if the image belongs to a campaign hosted by this user
    const campaign = await prisma.campaignCache.findFirst({
      where: {
        imageUrl: imageUrl,
        hostAddress: authenticatedAddress,
      },
    })

    if (!campaign) {
      console.error('❌ Authorization failed: User does not own this image')
      return NextResponse.json(
        { error: 'You do not have permission to delete this image' },
        { status: 403 }
      )
    }

    console.log(
      '✅ Authorization successful: User owns campaign',
      campaign.campaignId
    )

    // Delete from UploadThing
    try {
      await utapi.deleteFiles(fileKey)
      console.log(
        '✅ Image cleaned up successfully:',
        fileKey,
        'by user:',
        authenticatedAddress
      )

      return NextResponse.json({
        success: true,
        message: 'Image cleaned up successfully',
      })
    } catch (deleteError) {
      console.error('❌ Failed to delete image from storage')
      return NextResponse.json(
        { error: 'Failed to delete image from storage' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ Error in cleanup endpoint')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
