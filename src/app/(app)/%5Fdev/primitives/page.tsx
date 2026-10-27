import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PrimitivesGallery } from './gallery'

/**
 * /_dev/primitives: the 08-site primitives gallery, for visual QA only.
 *
 * NEVER shipped as a page in production: a production build (`next build`, NODE_ENV=production,
 * inlined at build time) renders the app's 404 here, and the gates check that
 * (tests/landing/gates.spec.ts, "app shell"). The folder is `%5Fdev` because Next.js treats
 * `_dev` as a private (unroutable) folder; `%5F` is the URL-encoded underscore.
 */
export const metadata: Metadata = {
  title: 'Primitives · DappDrop',
  robots: { index: false, follow: false },
}

export default function PrimitivesPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <PrimitivesGallery />
}
