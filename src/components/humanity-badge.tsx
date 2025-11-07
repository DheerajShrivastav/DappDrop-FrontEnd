// src/components/humanity-badge.tsx
import React from 'react'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck } from 'lucide-react'

interface HumanityBadgeProps {
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'sm' | 'default' | 'lg'
  showIcon?: boolean
}

export function HumanityBadge({ 
  variant = 'default', 
  size = 'default',
  showIcon = true 
}: HumanityBadgeProps) {
  return (
    <Badge 
      variant={variant}
      className={`
        ${size === 'sm' ? 'text-xs px-2 py-0.5' : ''}
        ${size === 'lg' ? 'text-sm px-3 py-1' : ''}
        bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200
      `}
    >
      {showIcon && <ShieldCheck className="h-3 w-3 mr-1" />}
      Humanity Verified Required
    </Badge>
  )
}

interface HumanityVerifiedStatusProps {
  isVerified: boolean
  size?: 'sm' | 'default' | 'lg'
}

export function HumanityVerifiedStatus({ isVerified, size = 'default' }: HumanityVerifiedStatusProps) {
  return (
    <Badge 
      variant={isVerified ? 'default' : 'secondary'}
      className={`
        ${size === 'sm' ? 'text-xs px-2 py-0.5' : ''}
        ${size === 'lg' ? 'text-sm px-3 py-1' : ''}
        ${isVerified 
          ? 'bg-green-100 text-green-700 border-green-300' 
          : 'bg-gray-100 text-gray-600 border-gray-300'
        }
      `}
    >
      <ShieldCheck className="h-3 w-3 mr-1" />
      {isVerified ? 'Human Verified' : 'Not Verified'}
    </Badge>
  )
}
