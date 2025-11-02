import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/context/wallet-provider';
import Header from '@/components/header';
import { Toaster } from '@/components/ui/toaster';
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'DApp Drop',
  description: 'Launch your project, engage real users, and build a thriving community on-chain.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`} style={{ scrollBehavior: 'smooth' }} suppressHydrationWarning>
      <body className="font-body antialiased min-h-screen flex flex-col bg-background" suppressHydrationWarning>
        <WalletProvider>
          <Header />
          <main className="flex-grow">{children}</main>
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}
