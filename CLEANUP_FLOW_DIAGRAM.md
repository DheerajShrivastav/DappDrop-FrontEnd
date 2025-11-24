# Image Cleanup Flow Diagram

## Scenario 1: Campaign Image Update

```
┌─────────────────────────────────────────────────────────────┐
│ Host uploads new image for existing campaign                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Image uploaded to UploadThing                            │
│    Result: New URL (e.g., https://utfs.io/f/new123.png)     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. POST /api/campaigns/[id]/image                           │
│    - Fetch existing campaign from DB                        │
│    - Extract old image URL (e.g., https://utfs.io/f/old.png)│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Delete old image from UploadThing                        │
│    - Extract file key: "old.png"                            │
│    - Call: utapi.deleteFiles("old.png")                     │
│    - ✅ Old image removed from storage                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Update database with new URL                             │
│    - CampaignCache.imageUrl = new123.png                    │
│    - ✅ Campaign displays new image                         │
└─────────────────────────────────────────────────────────────┘
```

## Scenario 2: Campaign Creation - Success

```
┌─────────────────────────────────────────────────────────────┐
│ User uploads image during campaign creation                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Image uploaded to UploadThing                            │
│    - URL stored in form state (uploadedImageUrl)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. User submits campaign form                               │
│    - Blockchain transaction creates campaign                │
│    - Campaign ID generated                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Image URL saved to database                              │
│    - POST /api/campaigns/[id]/image                         │
│    - CampaignCache created with imageUrl                    │
│    - ✅ Image linked to campaign                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Navigate to campaign page                                │
│    - Component unmounts                                     │
│    - No cleanup needed (image successfully linked)          │
└─────────────────────────────────────────────────────────────┘
```

## Scenario 3: Campaign Creation - Cancelled (Navigate Away)

```
┌─────────────────────────────────────────────────────────────┐
│ User uploads image during campaign creation                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Image uploaded to UploadThing                            │
│    - URL: https://utfs.io/f/orphan123.png                   │
│    - Stored in uploadedImageUrl state                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. User navigates away (clicks back, closes tab, etc)       │
│    - Form not submitted                                     │
│    - Campaign never created                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. useEffect cleanup runs on unmount                        │
│    - Detects uploadedImageUrl exists                        │
│    - Checks if URL contains "utfs.io"                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Cleanup orphaned image                                   │
│    - DELETE /api/campaigns/0/image                          │
│    - Extract file key: "orphan123.png"                      │
│    - Call: utapi.deleteFiles("orphan123.png")               │
│    - ✅ Orphaned image removed from storage                 │
└─────────────────────────────────────────────────────────────┘
```

## Scenario 4: Campaign Creation - Failed

```
┌─────────────────────────────────────────────────────────────┐
│ User uploads image during campaign creation                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. Image uploaded to UploadThing                            │
│    - URL stored in uploadedImageUrl state                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. User submits campaign form                               │
│    - Blockchain transaction FAILS                           │
│    - Error caught in try-catch block                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Cleanup in catch block                                   │
│    - Check if uploadedImageUrl exists                       │
│    - Call cleanupOrphanedImage(uploadedImageUrl)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Delete orphaned image                                    │
│    - DELETE /api/campaigns/0/image                          │
│    - utapi.deleteFiles(fileKey)                             │
│    - ✅ Orphaned image removed from storage                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. User can retry campaign creation                         │
│    - Can upload new image if desired                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Implementation Points

### extractFileKeyFromUrl Function
```typescript
Input:  "https://utfs.io/f/abc123.png"
Output: "abc123.png"

Used to extract the file key that UploadThing needs for deletion.
```

### Cleanup Conditions
1. ✅ URL contains "utfs.io" (UploadThing URL)
2. ✅ URL is not placeholder ("https://placehold.co/600x400")
3. ✅ URL is different from saved URL (for updates)

### Error Handling
All cleanup operations fail silently:
- Logs warning to console
- Does not throw error to user
- Does not block main operation

This ensures a smooth user experience even if cleanup fails.

### UTApi Methods Used
```typescript
import { UTApi } from 'uploadthing/server'

const utapi = new UTApi()

// Delete single file
await utapi.deleteFiles('fileKey.png')

// Delete multiple files
await utapi.deleteFiles(['key1.png', 'key2.png'])
```
