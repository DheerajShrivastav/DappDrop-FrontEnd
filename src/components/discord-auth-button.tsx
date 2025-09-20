'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquare } from 'lucide-react'

interface DiscordAuthButtonProps {
  onSuccess: (discordData: {
    id: string
    username: string
    discriminator?: string
  }) => void
  onError: (error: Error) => void
  beforeAuth?: () => void // New callback that runs before authentication starts
  disabled?: boolean
  className?: string
}

export function DiscordAuthButton({
  onSuccess,
  onError,
  beforeAuth,
  disabled = false,
  className = '',
}: DiscordAuthButtonProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const handleDiscordAuth = async () => {
    // Call the beforeAuth callback if provided
    if (beforeAuth) {
      beforeAuth()
    }

    setIsAuthenticating(true)

    // Clear any previous fallback data
    localStorage.removeItem('discord_auth_fallback')

    try {
      const authUrl = `/api/auth/discord?redirect=${encodeURIComponent(
        window.location.href
      )}`

      // Open a popup window for Discord OAuth
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const popup = window.open(
        authUrl,
        'discord-auth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      // Add a timer to periodically check for the fallback data
      // This is a backup in case the postMessage doesn't work
      const checkFallbackData = setInterval(() => {
        const fallbackData = localStorage.getItem('discord_auth_fallback')
        if (fallbackData) {
          try {
            const data = JSON.parse(fallbackData)
            console.log('Found fallback data:', data)

            if (data.success && data.user) {
              const { id, username, discriminator } = data.user
              onSuccess({ id, username, discriminator })
            } else if (!data.success && data.error) {
              onError(new Error(data.error))
            }

            // Clean up
            localStorage.removeItem('discord_auth_fallback')
            clearInterval(checkFallbackData)
            clearInterval(checkPopupClosed)
            window.removeEventListener('message', messageListener)
            setIsAuthenticating(false)

            if (!popup?.closed) {
              popup?.close()
            }
          } catch (e) {
            console.error('Error parsing fallback data:', e)
          }
        }
      }, 1000)

      // Create a message event listener to receive the auth data from the popup
      const messageListener = (event: MessageEvent) => {
        console.log('Received message event:', event)

        if (event.origin !== window.location.origin) {
          console.log('Ignoring message from different origin:', event.origin)
          return
        }

        console.log('Processing message data:', event.data)

        if (event.data?.type === 'discord-auth-success') {
          console.log('Auth success, user data:', event.data.user)
          const { id, username, discriminator } = event.data.user
          onSuccess({ id, username, discriminator })
          popup?.close()
        } else if (event.data?.type === 'discord-auth-error') {
          console.error('Auth error:', event.data.error)
          onError(
            new Error(event.data.error || 'Discord authentication failed')
          )
          popup?.close()
        } else {
          console.log('Unhandled message type:', event.data?.type)
        }

        window.removeEventListener('message', messageListener)
        setIsAuthenticating(false)
      }

      window.addEventListener('message', messageListener)

      // Fallback in case popup is closed without sending a message
      const checkPopupClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopupClosed)
          clearInterval(checkFallbackData) // Also clear the fallback check
          window.removeEventListener('message', messageListener)

          // If popup was closed but we didn't get a message, try to get data from localStorage
          // This is a fallback mechanism
          const fallbackData = localStorage.getItem('discord_auth_fallback')
          if (fallbackData) {
            try {
              const data = JSON.parse(fallbackData)
              console.log('Using fallback data from localStorage:', data)
              if (data.success && data.user) {
                const { id, username, discriminator } = data.user
                onSuccess({ id, username, discriminator })
              } else if (!data.success && data.error) {
                onError(new Error(data.error))
              }
              localStorage.removeItem('discord_auth_fallback')
            } catch (e) {
              console.error('Error parsing fallback data:', e)
            }
          } else {
            // If no fallback data, assume popup was closed without completing auth
            onError(new Error('Authentication was cancelled or failed.'))
          }

          setIsAuthenticating(false)
        }
      }, 500)
    } catch (error) {
      console.error('Discord auth error:', error)
      onError(
        error instanceof Error
          ? error
          : new Error('Failed to authenticate with Discord')
      )
      setIsAuthenticating(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleDiscordAuth}
      disabled={disabled || isAuthenticating}
      className={`bg-[#5865F2] text-white hover:bg-[#4752C4] ${className}`}
    >
      {isAuthenticating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="mr-2 h-4 w-4" />
      )}
      Connect with Discord
    </Button>
  )
}
