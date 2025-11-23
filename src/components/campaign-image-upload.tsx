'use client'

import { UploadButton } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

interface CampaignImageUploadProps {
  onUploadComplete?: (url: string) => void
}

export function CampaignImageUpload({
  onUploadComplete,
}: CampaignImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  return (
    <div className="space-y-2">
      <UploadButton<OurFileRouter, 'campaignImage'>
        endpoint="campaignImage"
        onClientUploadComplete={(res) => {
          setIsUploading(false)

          if (!res?.[0]?.url) {
            toast({
              title: 'Upload failed',
              description: 'No file URL returned',
              variant: 'destructive',
            })
            return
          }

          const imageUrl = res[0].url

          // Just return the URL to parent component - no database operations
          toast({
            title: 'Image uploaded',
            description: 'Image ready to be saved with campaign',
          })

          onUploadComplete?.(imageUrl)
        }}
        onUploadError={(error: Error) => {
          toast({
            title: 'Upload failed',
            description: error.message,
            variant: 'destructive',
          })
        }}
        onUploadBegin={() => {
          setIsUploading(true)
        }}
        content={{
          button({ ready }) {
            if (isUploading) return 'Uploading...'
            if (ready) return 'Upload Image'
            return 'Getting ready...'
          },
          allowedContent({ ready, fileTypes, isUploading }) {
            if (!ready) return 'Checking what you allow'
            if (isUploading) return 'Processing...'
            return `Image (max 4MB)`
          },
        }}
      />
    </div>
  )
}
