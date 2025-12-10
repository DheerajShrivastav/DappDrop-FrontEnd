import type { Metadata } from 'next';
import './globals.css';
import { Web3Provider } from '@/context/web3-provider';
import { WalletProvider } from '@/context/wallet-provider';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Toaster } from '@/components/ui/toaster';
import { Inter, Space_Grotesk } from 'next/font/google'

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
    title: 'DappDrop',
    description: 'Launch your project, engage real users, and build a thriving community on-chain.',
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
                <Web3Provider>
                    <WalletProvider>
                        <Header />
                        <main className="flex-grow">{children}</main>
                        <Footer />
                        <Toaster />
                    </WalletProvider>
                </Web3Provider>
            </body>
        </html>
    );
}

