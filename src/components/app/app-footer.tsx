import Link from 'next/link'
import { CompactFooter, type AppLink } from '@/components/landing/compact-footer'

/**
 * The app shell's footer: the shared compact footer (src/components/landing/compact-footer.tsx,
 * also used by the root 404), with app routes through next/link (never prefetched) and the
 * app's serif class. Server component (no client JS of its own).
 */
const AppRoute: AppLink = ({ href, className, children }) => (
  <Link href={href} prefetch={false} className={className}>
    {children}
  </Link>
)

export function AppFooter() {
  return <CompactFooter AppLink={AppRoute} displayClass="dd-display" data-app-footer="" />
}
