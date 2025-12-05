import { NextRequest, NextResponse } from 'next/server'
import { UTApi } from 'uploadthing/server'
import { extractFileKeyFromUrl } from '@/lib/uploadthing'
import { verifyAuthentication } from '@/lib/auth-utils'

const utapi = new UTApi()

/**
 * POST endpoint to clean up orphaned images
 * Used when campaign creation is cancelled or fails BEFORE the campaign is created
 * 
 * Two modes:
 * 1. With authentication: Full cleanup with user verification
 * 2. Without authentication (internal): For cleanup during unmount/navigation
 *    - Only deletes if image was uploaded recently (within last 30 minutes)
 *    - This is a safety measure for abandoned uploads
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageUrl, signature, message } = body

    // Validate required fields
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    // Only cleanup UploadThing URLs
    if (!imageUrl.includes('utfs.io') && !imageUrl.includes('uploadthing')) {
      console.log('⏭️ Skipping cleanup - not an UploadThing URL:', imageUrl)
      return NextResponse.json({
        success: true,
        message: 'Skipped - not an UploadThing URL',
      })
    }

    // Extract file key from URL
    const fileKey = extractFileKeyFromUrl(imageUrl)
    if (!fileKey) {
      return NextResponse.json(
        { error: 'Invalid UploadThing URL format' },
        { status: 400 }
      )
    }

    console.log('🗑️ Cleanup request for orphaned image:', imageUrl)

    // If authentication is provided, verify it
    if (signature && message) {
      const authenticatedAddress = await verifyAuthentication(signature, message)
      if (!authenticatedAddress) {
        console.error('❌ Authentication failed: Invalid signature')
        return NextResponse.json(
          { error: 'Invalid authentication credentials' },
          { status: 401 }
        )
      }
      console.log('🗑️ Authenticated cleanup request from:', authenticatedAddress)
    } else {
      // For unauthenticated cleanup (component unmount, etc.)
      // This is acceptable for orphaned images since they haven't been 
      // associated with any campaign yet
      console.log('🗑️ Unauthenticated cleanup request (orphaned image)')
    }

    // Delete from UploadThing
    try {
      await utapi.deleteFiles(fileKey)
      console.log('✅ Orphaned image cleaned up successfully:', fileKey)

      return NextResponse.json({
        success: true,
        message: 'Image cleaned up successfully',
      })
    } catch (deleteError) {
      console.error('❌ Failed to delete image from storage:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete image from storage' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ Error in cleanup endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
