import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/context/wallet-provider';
import Header from '@/components/header';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'DApp Drop Zone',
  description: 'Create and participate in airdrop campaigns',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ scrollBehavior: 'smooth' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <WalletProvider>
          <Header />
          <main className="flex-grow">{children}</main>
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}
