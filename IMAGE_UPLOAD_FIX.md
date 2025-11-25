# Image Upload Fix - Technical Documentation

## Problem Statement

The campaign image upload feature was not working correctly when trying to update images for existing campaigns. The issue was that while creating the campaign, the image URL needed to be saved to the database, but the campaign ID was not available at that point.

## Root Cause Analysis

The `CampaignImageUpload` component was initially designed only for use during campaign creation:
- During creation: Image is uploaded, URL returned to form, then saved with campaign after blockchain transaction completes
- After creation: Component needs to save directly to database, but lacked the necessary props (`campaignId`, `userAddress`)

When used in the campaign detail page (`/src/app/campaign/[id]/page.tsx`), it tried to pass these props but the component didn't accept them, causing TypeScript errors.

## Solution Architecture

### Dual-Mode Component Design

The `CampaignImageUpload` component now supports two modes of operation:

#### Mode 1: Campaign Creation (Original Behavior)
```typescript
<CampaignImageUpload
  onUploadComplete={(url) => {
    form.setValue('imageUrl', url)
  }}
/>
```
- No `campaignId` or `userAddress` provided
- Just uploads to UploadThing and returns URL to parent
- Parent handles database operations after campaign is created

#### Mode 2: Post-Creation Update (New Behavior)
```typescript
<CampaignImageUpload
  campaignId={parseInt(campaignId)}
  userAddress={address}
  onUploadComplete={(url) => {
    fetchAllCampaignData(true)
  }}
/>
```
- Both `campaignId` and `userAddress` provided
- Automatically saves to database via `/api/campaigns/[campaignId]/image`
- Shows success/error messages directly

### Implementation Details

```typescript
interface CampaignImageUploadProps {
  onUploadComplete?: (url: string) => void
  campaignId?: number          // NEW: Optional for post-creation updates
  userAddress?: string          // NEW: Optional for authorization
}
```

The `onClientUploadComplete` handler now checks if both optional props are provided:

```typescript
onClientUploadComplete={async (res) => {
  const imageUrl = res[0].url
  
  // If campaignId and userAddress are provided, save directly to database
  if (campaignId && userAddress) {
    // POST to /api/campaigns/${campaignId}/image
    // Show success/error toast
    onUploadComplete?.(imageUrl)
  } else {
    // Original behavior: just return URL
    toast({ title: 'Image uploaded' })
    onUploadComplete?.(imageUrl)
  }
}
```

## Database Flow

### During Campaign Creation
```
1. User uploads image → UploadThing
2. URL stored in form state
3. User submits form → createCampaign() blockchain transaction
4. Campaign ID generated from blockchain event
5. Image URL saved to DB with campaign ID: POST /api/campaigns/{id}/image
```

### After Campaign Creation (New)
```
1. Host visits campaign detail page
2. Clicks "Upload Image" button
3. Image uploads → UploadThing
4. Component automatically saves: POST /api/campaigns/{id}/image
5. Page refreshes to show new image
```

## API Endpoint

The existing API endpoint `/api/campaigns/[campaignId]/image` handles both flows:

```typescript
POST /api/campaigns/[campaignId]/image
Body: { imageUrl: string, userAddress: string }

- Validates userAddress matches campaign host
- Creates CampaignCache if not exists (fetches from blockchain)
- Updates imageUrl in CampaignCache
- Returns success
```

## Type Safety Improvements

### NextAuth Session Extension
Created `/src/types/next-auth.d.ts` to properly type the Discord ID:
```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      discordId?: string  // Extended property
    }
  }
}
```

### Ethereum Provider Interface
Created proper interface for ethereum event listeners:
```typescript
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, callback: (...args: unknown[]) => void) => void
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
}
```

## Error Handling

Robust error handling implemented throughout:

1. **Upload failures**: Toast with error message from UploadThing
2. **Network errors**: Catch and display user-friendly message
3. **Non-JSON responses**: Safe JSON parsing with fallback error message
4. **Authorization errors**: API validates host ownership before saving

## Testing Checklist

### Manual Testing Required

1. **Campaign Creation Flow** (Ensure no regression):
   - [ ] Create new campaign with image URL
   - [ ] Upload image during creation
   - [ ] Verify image shows on campaign card after creation
   - [ ] Verify image shows on campaign detail page

2. **Post-Creation Update Flow** (New feature):
   - [ ] Navigate to existing campaign as host
   - [ ] Find "Campaign Image" section in Host Controls
   - [ ] Click "Upload Image" button
   - [ ] Select image file (< 4MB)
   - [ ] Verify upload progress and success message
   - [ ] Verify image displays immediately
   - [ ] Refresh page and verify image persists

3. **Edge Cases**:
   - [ ] Non-host user should not see upload button
   - [ ] File > 4MB should be rejected
   - [ ] Network error should show error toast
   - [ ] Invalid campaign ID should return 404

## Benefits

✅ **Fixes the Original Issue**: Campaign images can now be uploaded/updated after creation
✅ **Backward Compatible**: No breaking changes to campaign creation flow
✅ **Type Safe**: All TypeScript errors resolved with proper types
✅ **User Friendly**: Clear success/error messages for all scenarios
✅ **Secure**: Host authorization enforced by backend API
✅ **Maintainable**: Clean separation of concerns, proper error handling

## Files Changed

1. `src/components/campaign-image-upload.tsx` - Added dual-mode support
2. `src/api/auth/[...nextauth]/route.ts` - Fixed TypeScript errors
3. `src/context/wallet-provider.tsx` - Improved type safety
4. `src/types/next-auth.d.ts` - Created session type extension

## Security Considerations

- ✅ Authorization checked at API level (not just frontend)
- ✅ Campaign ownership verified via blockchain data
- ✅ Image URLs validated (must be valid URLs)
- ✅ File size limited by UploadThing (4MB max)
- ✅ No sensitive data exposed in error messages

## Future Enhancements

Potential improvements for future iterations:
- Image cropping/editing before upload
- Multiple image support (gallery)
- Image deletion functionality
- Automatic image optimization
- Progress bar for large uploads
- Image preview before upload
