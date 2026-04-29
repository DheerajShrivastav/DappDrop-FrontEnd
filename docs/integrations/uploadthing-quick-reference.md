# Quick Reference: UploadThing Image Upload

## ✅ What Was Implemented

- Full-stack image upload system for campaign images
- Database integration with existing schema (no migration needed)
- Host-only access control
- Automatic fallback to placeholder images
- Type-safe implementation throughout

## 🚀 Quick Start

### 1. Get UploadThing API Keys

```bash
# Visit: https://uploadthing.com/dashboard
# Create app → Copy keys
```

### 2. Add to `.env.local`

```bash
UPLOADTHING_SECRET="sk_live_..."
UPLOADTHING_APP_ID="your-app-id"
```

### 3. Test Upload

1. Run app: `npm run dev`
2. Log in as campaign host
3. Navigate to campaign detail page
4. Find "Campaign Image" section in Host Controls
5. Click "Upload Image"

## 📁 Key Files

| File                                        | Purpose                 |
| ------------------------------------------- | ----------------------- |
| `src/app/api/uploadthing/core.ts`           | File router + auth      |
| `src/app/api/campaigns/[id]/image/route.ts` | Save URL to DB          |
| `src/components/campaign-image-upload.tsx`  | Upload button component |
| `docs/uploadthing-setup.md`                 | Full documentation      |

## 🔐 Security Features

- ✅ Wallet-based authentication
- ✅ Campaign host verification
- ✅ 4MB file size limit
- ✅ Image types only

## 🎨 UI Integration

- Campaign Card: Displays images with fallback
- Campaign Detail: Upload button for hosts
- Next.js Image: Automatic optimization

## 📊 Database

```prisma
model CampaignCache {
  imageUrl String? // ← Already exists!
}
```

## 🛠️ API Endpoints

### POST `/api/campaigns/[id]/image`

Save image URL to database

```json
{
  "imageUrl": "https://utfs.io/...",
  "userAddress": "0x..."
}
```

### GET `/api/campaigns/[id]/image`

Retrieve campaign image

```json
{
  "campaignId": 123,
  "imageUrl": "https://utfs.io/..."
}
```

## 🐛 Troubleshooting

- **No upload button?** → Check if you're the campaign host
- **Upload fails?** → Verify UploadThing API keys in `.env.local`
- **Image not showing?** → Check browser console for CORS errors

## 📦 Dependencies

```json
{
  "uploadthing": "latest",
  "@uploadthing/react": "latest"
}
```

## 🎯 Next Steps

1. Add credentials to `.env.local`
2. Test upload functionality
3. Optional: Add image editing/cropping
4. Optional: Add delete functionality
