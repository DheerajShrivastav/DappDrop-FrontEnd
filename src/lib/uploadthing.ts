import { generateReactHelpers } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'

export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>()

/**
 * Extract file key from UploadThing URL
 * Example: https://utfs.io/f/abc123.png -> abc123.png
 * 
 * @param url - The full UploadThing URL
 * @returns The file key or null if invalid
 */
export function extractFileKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // UploadThing URLs are in format: https://utfs.io/f/{fileKey}
    if (urlObj.hostname.includes('utfs.io')) {
      const pathParts = urlObj.pathname.split('/')
      // Validate that the second-to-last part is 'f' for correct URL structure
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
