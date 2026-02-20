'use client'

import { UploadButton } from '@uploadthing/react'
import type { OurFileRouter } from '@/app/api/uploadthing/core'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { BrowserProvider, Eip1193Provider } from 'ethers'
import { signAuthMessage } from '@/lib/wallet-auth'
// Extend window with ethereum property - matches web3-service.ts
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean
      request: (...args: any[]) => Promise<any>
      providers?: (Eip1193Provider & { isMetaMask?: boolean })[]
    }
  }
}

interface CampaignImageUploadProps {
  onUploadComplete?: (url: string) => void
  campaignId?: number
  userAddress?: string
}

/**
 * Set wallet authentication cookies for UploadThing middleware
 * Cookies are used because UploadThing handles its own request headers
 */
async function setWalletAuthCookies(): Promise<void> {
  const AUTH_COOKIE_MAX_AGE = 3600
  if (typeof window.ethereum === 'undefined') {
    throw new Error('Wallet not connected')
  }

  const provider = new BrowserProvider(window.ethereum)
  const { signature, message } = await signAuthMessage(provider)
  // Set cookies that will be sent with the upload request
  document.cookie = `wallet-signature=${encodeURIComponent(signature)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Strict`
  document.cookie = `wallet-message=${encodeURIComponent(message)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Strict`
}

/**
 * Clear wallet authentication cookies after upload completes or fails
 */
function clearWalletAuthCookies(): void {
  document.cookie = 'wallet-signature=; path=/; max-age=0'
  document.cookie = 'wallet-message=; path=/; max-age=0'
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
        onBeforeUploadBegin={async (files) => {
          // Sign message and set wallet auth cookies before upload starts
          try {
            await setWalletAuthCookies()
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : 'Failed to sign authentication message'
            toast({
              title: 'Authentication failed',
              description: errorMessage,
              variant: 'destructive',
            })
            throw error // Prevent upload from starting
          }
          return files
        }}
        onClientUploadComplete={async (res) => {
          setIsUploading(false)
          clearWalletAuthCookies()

          // UploadThing v7: URL can be in res[0].url (auto-populated) or res[0].serverData?.url (from onUploadComplete)
          const fileData = res?.[0]
          const imageUrl = fileData?.url || fileData?.serverData?.url

          console.log('📁 Upload response:', {
            url: fileData?.url,
            serverData: fileData?.serverData,
            key: fileData?.key,
          })

          if (!imageUrl) {
            toast({
              title: 'Upload failed',
              description: 'No file URL returned',
              variant: 'destructive',
            })
            return
          }

          // If campaignId and userAddress are provided, save directly to database
          if (campaignId != null && userAddress) {
            try {
              // Sign authentication message for the save operation
              if (typeof window.ethereum === 'undefined') {
                throw new Error('Wallet not connected')
              }

              const provider = new (await import('ethers')).BrowserProvider(
                window.ethereum,
              )
              const signer = await provider.getSigner()
              const address = await signer.getAddress()
              const nonce = Date.now().toString()
              const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
              const signature = await signer.signMessage(message)

              const response = await fetch(
                `/api/campaigns/${campaignId}/image`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    imageUrl,
                    signature,
                    message,
                  }),
                },
              )

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
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : 'Could not save image to database'
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
          clearWalletAuthCookies()
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
