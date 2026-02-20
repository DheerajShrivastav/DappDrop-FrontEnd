import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError } from 'uploadthing/server'
import { verifyWalletSession } from '@/app/lib/dal'

const f = createUploadthing()

// FileRouter for your app
export const ourFileRouter = {
  // Campaign image uploader with wallet authentication
  campaignImage: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async () => {
      try {
        const session = await verifyWalletSession()

        if (!session?.walletAddress) {
          throw new UploadThingError('Unauthorized: Invalid wallet signature')
        }

        return { walletAddress: session.walletAddress }
      } catch (error) {
        throw new UploadThingError('Unauthorized: Invalid wallet signature')
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('✅ Upload complete for wallet:', metadata.walletAddress)
      console.log('📁 File URL:', file.ufsUrl)
      console.log('📁 File key:', file.key)

      return { url: file.ufsUrl, uploadedBy: metadata.walletAddress }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
