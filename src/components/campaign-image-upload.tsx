'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserProvider, Eip1193Provider } from 'ethers'
import { useUploadThing } from '@/lib/uploadthing'
import { useToast } from '@/hooks/use-toast'
import { signAuthMessage } from '@/lib/wallet-auth'
import { Button, Spinner } from '@/components/app'
import { cn } from '@/lib/utils'
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

// Mirrors the `campaignImage` route config in src/app/api/uploadthing/core.ts. Checked on the
// client too so an oversized or non-image file is rejected before the wallet signature prompt.
const MAX_FILE_SIZE = 4 * 1024 * 1024

interface CampaignImageUploadProps {
  /** The current image URL, shown as a preview. Pass null/undefined for the empty dropzone. */
  value?: string | null
  onUploadComplete?: (url: string) => void
  /** When provided, the preview gets a Remove action that calls this. */
  onRemove?: () => void
  campaignId?: number
  userAddress?: string
  className?: string
}

type Phase = 'idle' | 'signing' | 'uploading'

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
  value,
  onUploadComplete,
  onRemove,
  campaignId,
  userAddress,
  className,
}: CampaignImageUploadProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // A new URL gets a fresh chance to load (e.g. after fixing a mistyped pasted URL).
  useEffect(() => setPreviewFailed(false), [value])

  const { startUpload } = useUploadThing('campaignImage', {
    uploadProgressGranularity: 'fine',
    onBeforeUploadBegin: async (files) => {
      // Sign message and set wallet auth cookies before upload starts
      setPhase('signing')
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
      setPhase('uploading')
      return files
    },
    onUploadProgress: setProgress,
    onClientUploadComplete: async (res) => {
      clearWalletAuthCookies()

      // UploadThing v7: URL can be in res[0].url (auto-populated) or res[0].serverData?.url (from onUploadComplete)
      const fileData = res?.[0]
      const imageUrl = fileData?.url || fileData?.serverData?.url

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

          const provider = new BrowserProvider(window.ethereum)
          const signer = await provider.getSigner()
          const address = await signer.getAddress()
          const nonce = Date.now().toString()
          const message = `Sign this message to authenticate with DappDrop\n\nWallet: ${address}\nNonce: ${nonce}`
          const signature = await signer.signMessage(message)

          const response = await fetch(`/api/campaigns/${campaignId}/image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageUrl,
              signature,
              message,
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
    },
    onUploadError: (error) => {
      clearWalletAuthCookies()
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const busy = phase !== 'idle'

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Unsupported file',
        description: 'Please choose an image file (PNG, JPG, GIF or WebP).',
        variant: 'destructive',
      })
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Image too large',
        description: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 4 MB.`,
        variant: 'destructive',
      })
      return
    }

    setProgress(0)
    try {
      await startUpload([file])
    } catch {
      // Signature rejection and upload errors are already surfaced as toasts above.
    } finally {
      setPhase('idle')
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const openPicker = () => {
    if (!busy) inputRef.current?.click()
  }

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      if (!busy) setIsDragging(true)
    },
    onDragLeave: (e: React.DragEvent) => {
      // Ignore dragleave events fired when moving over child elements.
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFile(e.dataTransfer.files?.[0])
    },
  }

  const statusLabel =
    phase === 'signing'
      ? 'Confirm the signature in your wallet…'
      : `Uploading… ${Math.round(progress)}%`

  const progressBar = (
    <div className="w-full max-w-xs space-y-2" aria-live="polite">
      <p className="text-[0.875rem] font-medium text-ink">{statusLabel}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-rule">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-300"
          style={{ width: phase === 'signing' ? '100%' : `${progress}%` }}
        />
      </div>
    </div>
  )

  return (
    <div className={cn('w-full', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div
          className={cn(
            'group relative aspect-[16/7] min-h-[9.5rem] w-full overflow-hidden rounded-md border border-rule-strong bg-sunk',
            // 16:9 gets very short on a phone, and the broken-image message shares the card with the
            // Replace/Remove row — keep it tall enough that they can't land on top of the text.
            previewFailed && 'min-h-[12rem]',
          )}
          {...dropHandlers}
        >
          {previewFailed ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 pb-16 pt-6 text-center text-ink-2">
              <p className="text-[0.875rem] font-medium text-ink">
                This image couldn&apos;t be loaded
              </p>
              <p className="text-[0.8125rem]">
                Check that the URL points directly to an image file, or upload one instead.
              </p>
            </div>
          ) : (
            // Arbitrary pasted URLs can come from any host, so next/image's allow-list doesn't fit here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Campaign cover preview"
              className="h-full w-full object-cover"
              // The error event can fire before React attaches onError (e.g. during hydration),
              // so also check a load that already finished with no pixels.
              ref={(img) => {
                if (img?.complete && img.naturalWidth === 0) setPreviewFailed(true)
              }}
              onError={() => setPreviewFailed(true)}
            />
          )}

          {(busy || isDragging) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/90 p-6 text-center">
              {busy ? (
                progressBar
              ) : (
                <>
                  <p className="text-[0.875rem] font-medium text-ink">Drop to replace the image</p>
                </>
              )}
            </div>
          )}

          {!busy && !isDragging && (
            // Solid surface buttons keep their contrast over any photo (no gradient scrim).
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 p-3">
              <Button size="sm" variant="secondary" className="bg-surface" onClick={openPicker}>
                Replace
              </Button>
              {onRemove && (
                <Button size="sm" variant="secondary" className="bg-surface" onClick={onRemove}>
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-disabled={busy}
          aria-label="Upload a campaign cover image"
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openPicker()
            }
          }}
          {...dropHandlers}
          className={cn(
            'flex aspect-[16/7] min-h-[9.5rem] w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-rule-strong bg-sunk p-6 text-center transition-colors [transition-duration:var(--dur-micro)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal',
            busy ? 'cursor-default' : 'cursor-pointer can-hover:hover:border-ink-2',
            isDragging && 'border-ink',
          )}
        >
          {busy ? (
            <>
              <Spinner className="text-ink-2" />
              {progressBar}
            </>
          ) : (
            <>
              <div className="grid gap-1">
                <p className="text-[0.9375rem] text-ink">
                  <span className="underline decoration-rule-strong underline-offset-4">Choose an image</span> or drop one here
                </p>
                <p className="font-mono text-[0.75rem] text-ink-2">
                  PNG, JPG, GIF or WebP · up to 4 MB · 1200 × 675 recommended
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
