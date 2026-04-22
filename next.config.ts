import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'uploadthing.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Only bundle the specific exports used from these heavy libraries
  // instead of pulling in their entire module trees
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-label',
      '@radix-ui/react-separator',
      '@radix-ui/react-progress',
      '@radix-ui/react-avatar',
      '@radix-ui/react-toast',
      '@radix-ui/react-slot',
      'date-fns',
      'framer-motion',
      'ethers',
      'zod',
      'react-hook-form',
      '@hookform/resolvers',
    ],
  },

  // Prevent server-only packages from being bundled into client chunks
  serverExternalPackages: ['@prisma/client', 'prisma'],
}

export default nextConfig
