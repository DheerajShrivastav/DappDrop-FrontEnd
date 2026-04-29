# Image Cleanup Feature Documentation

## Overview

This document describes the automatic cleanup functionality for uploaded campaign images to prevent orphaned files in UploadThing storage.

## Problem

When users upload images to UploadThing, the files remain in storage even if:
1. The user cancels campaign creation after uploading an image
2. The user updates a campaign image (leaving the old image orphaned)

This leads to unnecessary storage usage and costs.

## Solution

Implemented automatic cleanup in two scenarios:

### 1. Campaign Image Update

When a host updates an existing campaign's image, the old image is automatically deleted from UploadThing.

**Implementation Details:**
- Location: `/src/app/api/campaigns/[campaignId]/image/route.ts`
- When updating (`POST` request), the API:
  1. Checks if there's an existing image URL
  2. Verifies the new URL is different from the old one
  3. Extracts the file key from the old UploadThing URL
  4. Deletes the old file using `UTApi.deleteFiles()`
  5. Updates the database with the new URL

**Code Flow:**
```typescript
// Extract old image URL from database
const oldImageUrl = existingCache.imageUrl

// If exists and different from new URL
if (oldImageUrl && oldImageUrl !== newImageUrl) {
  const fileKey = extractFileKeyFromUrl(oldImageUrl)
  await utapi.deleteFiles(fileKey)
}

// Update database with new URL
await prisma.campaignCache.update({ imageUrl: newImageUrl })
```

### 2. Campaign Creation Cancellation

When a user uploads an image during campaign creation but doesn't complete the process (navigates away or creation fails), the uploaded image is automatically cleaned up.

**Implementation Details:**
- Location: `/src/app/create-campaign/page.tsx`
- Uses React `useEffect` cleanup function
- Triggers when:
  - Component unmounts (user navigates away)
  - Campaign creation fails with an uploaded image

**Code Flow:**
```typescript
useEffect(() => {
  return () => {
    // Cleanup on unmount
    const imageUrl = uploadedImageUrl || form.getValues('imageUrl')
    if (imageUrl && imageUrl.includes('utfs.io')) {
      cleanupOrphanedImage(imageUrl)
    }
  }
}, [uploadedImageUrl])

// Also cleanup on creation failure
try {
  await createCampaign(data)
} catch (e) {
  if (uploadedImageUrl) {
    cleanupOrphanedImage(uploadedImageUrl)
  }
}
```

### 3. Manual Cleanup API

Added a `DELETE` endpoint for explicit image deletion.

**API Endpoint:**
```
DELETE /api/campaigns/[campaignId]/image
Body: { imageUrl: string }
```

**Usage:**
```typescript
await fetch('/api/campaigns/0/image', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageUrl })
})
```

## Helper Functions

### extractFileKeyFromUrl()

Extracts the file key from UploadThing URLs for deletion.

```typescript
function extractFileKeyFromUrl(url: string): string | null {
  // Example: https://utfs.io/f/abc123.png -> abc123.png
  const urlObj = new URL(url)
  if (urlObj.hostname.includes('utfs.io')) {
    const pathParts = urlObj.pathname.split('/')
    return pathParts[pathParts.length - 1]
  }
  return null
}
```

## UTApi Integration

Uses the official UploadThing server SDK:

```typescript
import { UTApi } from 'uploadthing/server'

const utapi = new UTApi()

// Delete single file
await utapi.deleteFiles('fileKey.png')

// Delete multiple files
await utapi.deleteFiles(['key1.png', 'key2.png'])
```

## Error Handling

All cleanup operations are designed to fail silently to avoid disrupting user experience:

1. **Update scenario**: Logs warning but continues with database update
2. **Unmount cleanup**: Silent failure (console warning only)
3. **Creation failure**: Silent failure (console warning only)

```typescript
try {
  await utapi.deleteFiles(fileKey)
  console.log('✅ Image deleted successfully')
} catch (error) {
  console.warn('⚠️ Failed to delete image:', error)
  // Continue - don't block main operation
}
```

## Security Considerations

1. **Authorization**: Only campaign hosts can update/delete images
2. **URL Validation**: Only UploadThing URLs are processed
3. **File Key Extraction**: Validates URL format before extraction
4. **No Sensitive Data**: Errors don't expose sensitive information

## Testing

### Manual Testing Checklist

**Update Flow:**
- [x] Upload image to existing campaign
- [x] Verify old image is deleted from UploadThing
- [x] Verify new image displays correctly
- [x] Check UploadThing dashboard for orphaned files

**Cancellation Flow:**
- [x] Upload image during campaign creation
- [x] Navigate away without completing
- [x] Verify image is deleted from UploadThing
- [x] Repeat with creation failure scenario

**Edge Cases:**
- [x] Update to same image (no deletion)
- [x] Update to external URL (no deletion)
- [x] Delete non-existent file (silent failure)
- [x] Invalid UploadThing URL (graceful handling)

## Environment Requirements

- `UPLOADTHING_SECRET`: Required for UTApi authentication
- `UPLOADTHING_APP_ID`: Required for UploadThing client

## Benefits

1. **Cost Savings**: Prevents accumulation of unused files
2. **Storage Efficiency**: Keeps UploadThing storage clean
3. **User Experience**: Automatic, transparent operation
4. **Security**: Proper authorization and validation

## Limitations

1. **Unmount Timing**: Cleanup may not trigger if browser crashes
2. **Network Failures**: Delete requests may fail silently
3. **UploadThing URLs Only**: External URLs are not cleaned up
4. **No Batch History**: Can't retroactively clean old orphaned files

## Future Enhancements

1. Add admin panel to view and clean orphaned files
2. Implement periodic cleanup job for missed deletions
3. Add deletion confirmation for manual operations
4. Track deletion metrics for monitoring
5. Support bulk cleanup operations
