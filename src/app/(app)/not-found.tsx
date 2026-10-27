import Link from 'next/link'
import { EmptyState } from '@/components/app/states'
import { buttonClass } from '@/components/app/button'

/**
 * notFound() inside an app route (an unknown campaign id, the dev-only primitives gallery in a
 * production build) renders here, inside the app shell. Unknown URLs elsewhere use the root
 * not-found.
 */
export default function AppNotFound() {
  return (
    <div className="lp-container pb-24 pt-14">
      <p className="dd-eyebrow">404</p>
      <h1 className="dd-display dd-h1 mt-4 text-ink">This page doesn&apos;t exist.</h1>
      <EmptyState
        className="mt-8"
        headingLevel="p"
        title="It may have moved, or the link is wrong."
        body="Campaigns live at /campaign/ followed by their number."
        action={
          <Link href="/campaigns" prefetch={false} className={buttonClass()}>
            Browse campaigns
          </Link>
        }
      />
    </div>
  )
}
