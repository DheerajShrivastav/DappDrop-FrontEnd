import { NextRequest, NextResponse } from 'next/server'
import { UTApi } from 'uploadthing/server'

const utapi = new UTApi()

/**
 * Extract file key from UploadThing URL
 * Example: https://utfs.io/f/abc123.png -> abc123.png
 */
function extractFileKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // UploadThing URLs are in format: https://utfs.io/f/{fileKey}
    if (urlObj.hostname.includes('utfs.io')) {
      const pathParts = urlObj.pathname.split('/')
      // Validate that the second-to-last part is 'f'
      if (pathParts.length >= 2 && pathParts[pathParts.length - 2] === 'f') {
        const fileKey = pathParts[pathParts.length - 1]
        return fileKey || null
      }
    }
    return null
  } catch {
    return null
  }
}

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
