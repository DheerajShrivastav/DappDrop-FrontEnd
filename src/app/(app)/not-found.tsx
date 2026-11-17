import Link from 'next/link'
import { buttonClass } from '@/components/app/button'
import { PageContainer, PageHeader } from '@/components/app/page-header'

/**
 * notFound() inside an app route (an unknown campaign id, the dev-only primitives gallery in a
 * production build) renders here, inside the app shell. Unknown URLs elsewhere use the root
 * not-found (src/app/not-found.tsx). Refine pass: the same page as the root 404 (eyebrow, H1,
 * lead and both ways back), so the site has one 404, not two.
 */
export default function AppNotFound() {
  return (
    <PageContainer className="md:pb-32">
      <PageHeader
        eyebrow="404 · Page not found"
        title="This page doesn’t exist."
        lead="It may have moved, or the link is wrong. Campaigns live at /campaign/ followed by their number."
      />
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" prefetch={false} className={buttonClass()}>
          Back to the home page
        </Link>
        <Link href="/campaigns" prefetch={false} className={buttonClass({ variant: 'secondary' })}>
          Browse campaigns
        </Link>
      </div>
    </PageContainer>
  )
}
