# UploadThing Image Upload Implementation

## Summary

Full-stack implementation of UploadThing image upload system for campaign images with database integration and security controls.

## Files Created

### Backend API

1. **`src/app/api/uploadthing/core.ts`**

   - File router configuration
   - Authentication middleware (wallet-based)
   - Campaign image endpoint (4MB max)

2. **`src/app/api/uploadthing/route.ts`**

   - Next.js App Router handler
   - GET/POST route exports

3. **`src/app/api/campaigns/[campaignId]/image/route.ts`**
   - POST: Save image URL to database
   - GET: Retrieve campaign image URL
   - Authorization: Host-only access

### Frontend Components

4. **`src/components/campaign-image-upload.tsx`**
   - UploadButton wrapper component
   - Toast notifications for upload status
   - Automatic database integration

### Utilities

5. **`src/lib/uploadthing.ts`**

   - React helpers for UploadThing
   - Type-safe hooks

6. **`src/lib/campaign-image.ts`**
   - Image URL fetching utility
   - Placeholder fallback constant

### Configuration

7. **Updated `next.config.ts`**

   - Added UploadThing domains to `remotePatterns`
   - Enables Next.js Image optimization for uploaded images

8. **Updated `.env.example`**
   - Added UploadThing environment variables
   - Setup instructions included

### Documentation

9. **`docs/uploadthing-setup.md`**
   - Complete setup guide
   - Troubleshooting tips
   - API documentation

## Files Modified

### Campaign Display

- **`src/components/campaign-card.tsx`**

  - Added fallback for missing images
  - Added `unoptimized` prop for external URLs

- **`src/app/campaign/[id]/page.tsx`**
  - Added `CampaignImageUpload` component in Host Controls
  - Added fallback for missing images
  - Imported `ImageIcon` from Lucide

## Database Schema

No migration needed! The `CampaignCache` model already has:

```prisma
imageUrl String? // nullable field, ready to use
```

## Key Features

### Security

- ✅ Wallet-based authentication
- ✅ Host-only upload authorization
- ✅ Campaign ownership validation
- ✅ 4MB file size limit

### User Experience

- ✅ Drag-and-drop upload
- ✅ Real-time upload progress
- ✅ Toast notifications
- ✅ Automatic refresh after upload
- ✅ Graceful fallback to placeholder

### Type Safety

- ✅ Full TypeScript support
- ✅ Prisma type generation
- ✅ UploadThing type inference

## Installation Steps

1. **Install packages** (Already done):

   ```bash
   npm install uploadthing @uploadthing/react
   ```

2. **Set environment variables**:

   ```bash
   UPLOADTHING_SECRET="sk_live_..."
   UPLOADTHING_APP_ID="your-app-id"
   ```

3. **Get API keys**:

   - Visit https://uploadthing.com/dashboard
   - Create a new app
   - Copy Secret Key and App ID

4. **Test the feature**:
   - Log in as a campaign host
   - Navigate to campaign detail page
   - Scroll to "Host Controls & Analytics"
   - Click "Upload Image" button

## Technical Details

### Upload Flow

```
User clicks "Upload Image"
  ↓
UploadThing modal opens
  ↓
User selects image (validated: 4MB max, image types)
  ↓
File uploads to UploadThing CDN
  ↓
URL returned to client
  ↓
POST /api/campaigns/[id]/image (saves URL to DB)
  ↓
Campaign data refreshed
  ↓
New image displayed
```

### Authorization Flow

```
Upload request
  ↓
Extract userAddress from request
  ↓
Fetch campaign from database
  ↓
Compare campaign.hostAddress with userAddress
  ↓
If match: Allow upload
If mismatch: Return 403 Forbidden
```

## Next Steps

1. Add UploadThing credentials to `.env.local`
2. Test upload as campaign host
3. Consider adding:
   - Image cropping/editing
   - Multiple image support
   - Image deletion functionality
   - Bulk upload for multiple campaigns

## Dependencies Added

- `uploadthing` - Core UploadThing library
- `@uploadthing/react` - React components and hooks

## No Breaking Changes

All changes are additive - existing functionality remains intact.
