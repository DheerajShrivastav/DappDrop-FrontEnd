import { NextRequest, NextResponse } from 'next/server'
import { UTApi } from 'uploadthing/server'
import { extractFileKeyFromUrl } from '@/lib/uploadthing'

const utapi = new UTApi()

/**
 * POST endpoint to clean up orphaned images
 * Used when campaign creation is cancelled or fails
 */
export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    console.log('🗑️ Cleanup request for image:', imageUrl)

    // Extract file key from URL
    const fileKey = extractFileKeyFromUrl(imageUrl)
    if (!fileKey) {
      return NextResponse.json(
        { error: 'Invalid UploadThing URL format' },
        { status: 400 }
      )
    }

    // Delete from UploadThing
    try {
      await utapi.deleteFiles(fileKey)
      console.log('✅ Image cleaned up successfully:', fileKey)

      return NextResponse.json({
        success: true,
        message: 'Image cleaned up successfully',
      })
    } catch (deleteError) {
      console.error('❌ Failed to delete image:', deleteError)
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
