'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TestnetBanner() {
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) return null

    return (
        <div className="relative w-full bg-sky-50 border-b border-sky-200">
            <div className="flex items-center justify-center py-2.5 px-4">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-sky-600" />
                    <p className="text-sm text-sky-900 font-medium">
                        <span className="font-semibold">Testnet Mode</span> · This DApp is running on testnet. Do not use mainnet tokens.
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-4 text-sky-600 hover:text-sky-900 hover:bg-sky-100"
                        onClick={() => setIsVisible(false)}
                        aria-label="Dismiss testnet warning"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

// Alternative futuristic purple/blue gradient version
export function TestnetBannerFuturistic() {
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) return null

    return (
        <div className="relative w-full overflow-hidden">
            {/* Animated gradient background */}
            <div className="relative bg-gradient-to-r from-indigo-900 via-cyan-900 to-indigo-900 animate-gradient-x">
                {/* Shimmering overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-200/10 to-transparent animate-shimmer"></div>

                {/* Content container */}
                <div className="relative flex items-center justify-center py-3 px-4">
                    <div className="flex items-center gap-2 text-cyan-100">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-cyan-400" />
                        <p className="text-xs font-bold uppercase tracking-wide text-center">
                            <span className="hidden sm:inline">Note: </span>
                            DApp is currently on testnet - do not use mainnet tokens
                        </p>
                    </div>

                    {/* Close button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 h-8 w-8 p-0 text-cyan-100 hover:bg-cyan-400/20 hover:text-white"
                        onClick={() => setIsVisible(false)}
                        aria-label="Dismiss testnet warning"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
