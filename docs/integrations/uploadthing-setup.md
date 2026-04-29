# UploadThing Image Upload Setup Guide

## Overview

This application uses [UploadThing](https://uploadthing.com) for campaign image uploads with direct database integration.

## Features

- ✅ Type-safe file uploads with 4MB max size
- ✅ Authentication via wallet address
- ✅ Direct database integration (no ghost uploads)
- ✅ Host-only access control
- ✅ Automatic fallback to placeholder images
- ✅ Next.js Image optimization support

## Setup Instructions

### 1. Create UploadThing Account

1. Go to [https://uploadthing.com](https://uploadthing.com)
2. Sign up or log in
3. Create a new app

### 2. Get API Keys

1. Navigate to your app's dashboard
2. Copy your **Secret Key** and **App ID**
3. Add them to your `.env.local` file:

```bash
UPLOADTHING_SECRET="sk_live_..."
UPLOADTHING_APP_ID="your-app-id"
```

### 3. Configure UploadThing (Already Done)

The following files have been set up:

- **`src/app/api/uploadthing/core.ts`**: File router with authentication middleware
- **`src/app/api/uploadthing/route.ts`**: Next.js App Router handler
- **`src/app/api/campaigns/[campaignId]/image/route.ts`**: Database integration API

### 4. Database Schema (No Migration Needed)

The `CampaignCache` model already includes the `imageUrl` field:

```prisma
model CampaignCache {
  id              String   @id @default(cuid())
  campaignId      Int
  imageUrl        String?  // ✅ Already exists
  // ... other fields
}
```

### 5. Frontend Components (Already Created)

#### CampaignImageUpload Component

Located at `src/components/campaign-image-upload.tsx`

**Usage:**

```tsx
<CampaignImageUpload
  campaignId={123}
  userAddress="0x..."
  onUploadComplete={(url) => console.log('Uploaded:', url)}
/>
```

#### Integration Points

- **Campaign Detail Page**: Upload button in "Host Controls" section
- **Campaign Card**: Displays uploaded images with fallback
- **Image Display**: Uses Next.js `Image` component with optimization

## How It Works

### Upload Flow

1. **Host clicks "Upload Image"** → UploadThing upload modal opens
2. **User selects image** → File validated (max 4MB, image types only)
3. **Upload to UploadThing** → File stored on their CDN
4. **Save URL to database** → API saves URL to `CampaignCache.imageUrl`
5. **Refresh campaign data** → New image displayed immediately

### Security

- ✅ **Authentication**: Requires wallet address
- ✅ **Authorization**: Only campaign host can upload
- ✅ **Validation**: 4MB max, image types only
- ✅ **Database check**: Verifies `hostAddress` matches uploader

### API Endpoints

#### POST `/api/campaigns/[campaignId]/image`

Save uploaded image URL to database.

**Request:**

```json
{
  "imageUrl": "https://utfs.io/...",
  "userAddress": "0x..."
}
```

**Response:**

```json
{
  "success": true,
  "campaignId": 123,
  "imageUrl": "https://utfs.io/..."
}
```

#### GET `/api/campaigns/[campaignId]/image`

Retrieve campaign image URL.

**Response:**

```json
{
  "campaignId": 123,
  "imageUrl": "https://utfs.io/..."
}
```

## Troubleshooting

### "Unauthorized" Error

- Ensure wallet is connected
- Verify you are the campaign host
- Check `userAddress` is being passed correctly

### Image Not Displaying

- Check if `imageUrl` is saved in database: `GET /api/campaigns/[id]/image`
- Verify Next.js `remotePatterns` in `next.config.ts` includes UploadThing domains
- Check browser console for CORS errors

### Upload Fails

- Verify UploadThing API keys are set correctly
- Check file size (max 4MB)
- Ensure file is an image type (jpg, png, gif, etc.)

## Next Steps

1. Add UploadThing API keys to `.env.local`
2. Test upload functionality as a campaign host
3. (Optional) Add image cropping/editing before upload
4. (Optional) Add ability to delete uploaded images

## Additional Resources

- [UploadThing Docs](https://docs.uploadthing.com)
- [Next.js Image Optimization](https://nextjs.org/docs/app/api-reference/components/image)
