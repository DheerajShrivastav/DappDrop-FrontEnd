import './app.css'
import type { Viewport } from 'next'
import { MotionConfig } from 'framer-motion'
import { Toaster } from '@/components/ui/toaster'
import { display, mono } from '@/app/_fonts/landing-fonts'
import { THEME_COLOR } from '@/components/landing/theme'
import { Web3Provider } from '@/context/web3-provider'
import { WalletProvider } from '@/context/wallet-provider'
import { HumanityAuthProvider } from '@/context/humanity-provider'
import { AppHeader } from '@/components/app/app-header'
import { AppFooter } from '@/components/app/app-footer'

/**
 * 08-site phase 1: the app routes in Monolith. `.app-theme` scopes the Obsidian / Porcelain
 * tokens and the shadcn remap (./app.css); <html data-theme> is set before paint by the root
 * layout's no-flash script, and the header's toggle is the marketing pages' one.
 *
 * Fonts: the landing's two files (Newsreader display, JetBrains Mono); body text is the system
 * stack. The app no longer loads Inter or Space Grotesk. The font variables are also written on
 * :root, so content Radix portals into <body> (dialogs, popovers, toasts) gets them too.
 */
export const viewport: Viewport = {
    colorScheme: 'dark',
    themeColor: THEME_COLOR.obsidian,
}

const FONT_VARS = `:root{--font-display:${display.style.fontFamily};--font-mono:${mono.style.fontFamily}}`

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${display.variable} ${mono.variable} app-theme flex min-h-screen flex-grow flex-col bg-paper text-ink`}>
            <style dangerouslySetInnerHTML={{ __html: FONT_VARS }} />
            <a href="#main" className="skip-link">
                Skip to main content
            </a>
            {/* Global reduced-motion gate: every framer-motion animation in the app
                automatically collapses to instant when the user prefers reduced motion,
                without needing to thread useReducedMotion() through each component.
                (Moved here from the root layout so the landing page ships no framer-motion.) */}
            <MotionConfig reducedMotion="user">
                <Web3Provider>
                    <WalletProvider>
                        <HumanityAuthProvider>
                            <AppHeader />
                            {/* tabIndex -1: the skip link moves keyboard focus here too. */}
                            <main id="main" tabIndex={-1} className="flex-grow outline-none">
                                {children}
                            </main>
                            <AppFooter />
                        </HumanityAuthProvider>
                    </WalletProvider>
                </Web3Provider>
            </MotionConfig>
            <Toaster />
        </div>
    );
}
