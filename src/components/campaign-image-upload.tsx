'use client'

import { UploadButton } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

interface CampaignImageUploadProps {
  onUploadComplete?: (url: string) => void
  campaignId?: number
  userAddress?: string
}

export function CampaignImageUpload({
  onUploadComplete,
  campaignId,
  userAddress,
}: CampaignImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  return (
    <div className="space-y-2">
      <UploadButton<OurFileRouter, 'campaignImage'>
        endpoint="campaignImage"
        onClientUploadComplete={async (res) => {
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

          // If campaignId and userAddress are provided, save directly to database
          if (campaignId != null && userAddress) {
            try {
              const response = await fetch(`/api/campaigns/${campaignId}/image`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  imageUrl,
                  userAddress,
                }),
              })

              if (!response.ok) {
                let errorMessage = 'Failed to save image'
                try {
                  const error = await response.json()
                  errorMessage = error.error || errorMessage
                } catch {
                  // If JSON parsing fails, use default error message
                }
                throw new Error(errorMessage)
              }

              toast({
                title: 'Image updated',
                description: 'Campaign image has been updated successfully',
              })

              onUploadComplete?.(imageUrl)
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Could not save image to database'
              toast({
                title: 'Failed to save image',
                description: errorMessage,
                variant: 'destructive',
              })
            }
          } else {
            // Just return the URL to parent component - no database operations
            toast({
              title: 'Image uploaded',
              description: 'Image ready to be saved with campaign',
            })

            onUploadComplete?.(imageUrl)
          }
        }}
        onUploadError={(error: Error) => {
          setIsUploading(false)
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
