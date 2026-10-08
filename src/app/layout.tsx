import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Inter, Space_Grotesk } from 'next/font/google'
import { MotionConfig } from 'framer-motion'

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
})

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-space-grotesk',
})

export const metadata: Metadata = {
    title: 'DappDrop: Web3 quest campaigns with rewards in on-chain escrow',
    description:
        'Run token and NFT reward campaigns with on-chain escrow. Reward lists are public for 24 hours before claims open. Public beta on Sepolia testnet.',
    icons: {
        icon: '/icon.svg',
        shortcut: '/icon.svg',
        apple: '/icon.svg',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} style={{ scrollBehavior: 'smooth' }} suppressHydrationWarning>
            <body className="font-body antialiased min-h-screen flex flex-col bg-background" suppressHydrationWarning>
                {/* Global reduced-motion gate: every framer-motion animation in the app
                    automatically collapses to instant when the user prefers reduced motion,
                    without needing to thread useReducedMotion() through each component. */}
                <MotionConfig reducedMotion="user">
                    {children}
                </MotionConfig>
                <Toaster />
            </body>
        </html>
    );
}
