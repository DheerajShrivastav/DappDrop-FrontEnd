import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import '../../campaign/[id]/campaign.css'
import { CampaignFixtures } from './fixtures'

/**
 * /_dev/campaign?state=<key>: the campaign page in every wallet-only state (connected, host,
 * claimable, claimed…), on EXAMPLE data, for screenshots and the dev-server gates.
 *
 * NEVER shipped in production: a production build renders the app's 404 here (gated in
 * tests/landing/app-campaign.gates.spec.ts), like /_dev/primitives. `%5Fdev` because Next treats
 * `_dev` as a private folder.
 */
export const metadata: Metadata = {
  title: 'Campaign fixtures · DappDrop',
  robots: { index: false, follow: false },
}

export default function CampaignFixturesPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <CampaignFixtures />
}
