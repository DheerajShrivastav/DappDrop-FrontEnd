import type { NextConfig } from 'next'
import { officialDomain, redirectHosts } from './src/config/site'

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

  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    }
    return config
  },

  // QW-04: the vercel.app host 308s to the official domain. API routes and the Humanity OAuth
  // callback are excluded: an OAuth flow that started on one host must finish on that host
  // (its state cookie lives there), and server-to-server callers shouldn't be bounced.
  async redirects() {
    return redirectHosts.map((host) => ({
      source: '/:path((?!api/|humanity-callback).*)',
      has: [{ type: 'host' as const, value: host }],
      destination: `https://${officialDomain}/:path`,
      permanent: true,
    }))
  },

  // Prevent server-only packages from being bundled into client chunks
  serverExternalPackages: ['@prisma/client', 'prisma'],
}

export default nextConfig
