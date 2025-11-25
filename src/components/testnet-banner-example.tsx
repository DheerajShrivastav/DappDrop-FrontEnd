// Example usage in layout.tsx or any page component

import { TestnetBanner } from '@/components/testnet-banner'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Testnet banner - sits above navigation */}
      <TestnetBanner />

      {/* Your navigation component */}
      <nav className="border-b">{/* Navigation content */}</nav>

      {/* Main content */}
      <main>{children}</main>
    </div>
  )
}

// Alternative: Use the futuristic version
// import { TestnetBannerFuturistic } from '@/components/testnet-banner'
// <TestnetBannerFuturistic />
