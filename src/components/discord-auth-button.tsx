'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare } from 'lucide-react';

interface DiscordAuthButtonProps {
  onSuccess: (discordData: { id: string; username: string; discriminator?: string }) => void;
  onError: (error: Error) => void;
  disabled?: boolean;
  className?: string;
}

export function DiscordAuthButton({ 
  onSuccess, 
  onError, 
  disabled = false,
  className = ''
}: DiscordAuthButtonProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleDiscordAuth = async () => {
    setIsAuthenticating(true);
    
    try {
      const authUrl = `/api/auth/discord?redirect=${encodeURIComponent(window.location.href)}`;
      
      // Open a popup window for Discord OAuth
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        authUrl,
        'discord-auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      // Create a message event listener to receive the auth data from the popup
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data?.type === 'discord-auth-success') {
          const { id, username, discriminator } = event.data.user;
          onSuccess({ id, username, discriminator });
          popup?.close();
        } else if (event.data?.type === 'discord-auth-error') {
          onError(new Error(event.data.error || 'Discord authentication failed'));
          popup?.close();
        }
        
        window.removeEventListener('message', messageListener);
        setIsAuthenticating(false);
      };
      
      window.addEventListener('message', messageListener);
      
      // Fallback in case popup is closed without sending a message
      const checkPopupClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopupClosed);
          window.removeEventListener('message', messageListener);
          setIsAuthenticating(false);
        }
      }, 500);
      
    } catch (error) {
      console.error('Discord auth error:', error);
      onError(error instanceof Error ? error : new Error('Failed to authenticate with Discord'));
      setIsAuthenticating(false);
    }
  };

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
  );
}
