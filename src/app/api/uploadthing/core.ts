import { createUploadthing, type FileRouter } from 'uploadthing/next'

const f = createUploadthing()

// FileRouter for your app
export const ourFileRouter = {
  // Campaign image uploader
  // Note: Authorization happens when saving to database via /api/campaigns/[id]/image
  // This allows upload to complete, but only authorized users can link it to a campaign
  campaignImage: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async () => {
      // Return empty metadata - authorization handled at database level
      return {}
    })
    .onUploadComplete(async ({ file }) => {
      // This runs on your server after upload

      // Return data to be sent to client
      return { url: file.url }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
