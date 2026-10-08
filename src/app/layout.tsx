import type { Metadata } from 'next';
import './globals.css';

// The root layout is deliberately thin: it renders on every route, including the landing page,
// which has a hard JS and font budget. App-only pieces live where they're used:
// - Inter / Space Grotesk: src/app/_fonts/app-fonts.tsx, rendered by (app)/layout and the
//   about/changelog pages;
// - framer-motion's MotionConfig and the Toaster: (app)/layout.tsx.
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
        <html lang="en" suppressHydrationWarning>
            <body className="font-body antialiased min-h-screen flex flex-col bg-background" suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}
