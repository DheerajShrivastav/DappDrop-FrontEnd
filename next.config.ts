import type { NextConfig } from 'next'
import { officialDomain, redirectHosts } from './src/config/site'

// QW-08: security headers.
// The landing page's CSP (B2 stopgap, TRS-approved): 'unsafe-inline' scripts because / is
// static (no nonces) and Next inlines its flight data; no 'unsafe-eval'; Report-Only first.
// After 7 days with 0 reports at /api/csp-report, switch the header name to enforce it.
const LANDING_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'report-uri /api/csp-report',
].join('; ')

// Every route, including the wallet pages: these don't restrict scripts or connections, so they
// can't break RainbowKit/WalletConnect. Clickjacking protection (frame-ancestors + XFO) ships on
// the app routes in the same release as the landing CSP (OUT-A04).
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
]

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

  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/', headers: [{ key: 'Content-Security-Policy-Report-Only', value: LANDING_CSP }] },
    ]
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

  // QW-07: cookieless analytics through first-party paths, so the landing CSP can stay
  // script-src/connect-src 'self'. Only when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set at build time.
  async rewrites() {
    if (!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) return []
    const host = (process.env.PLAUSIBLE_HOST || 'https://plausible.io').replace(/\/$/, '')
    return [
      { source: '/js/pl.js', destination: `${host}/js/script.js` },
      { source: '/api/event', destination: `${host}/api/event` },
    ]
  },

  // Prevent server-only packages from being bundled into client chunks
  serverExternalPackages: ['@prisma/client', 'prisma'],
}

export default nextConfig
