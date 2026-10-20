import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CreateCampaignFixture } from './fixture'

/**
 * /_dev/create-campaign?state=…: the /create-campaign gate and wizard in wallet-only states, with
 * example data, for screenshots and visual QA (08-site phase 2). Like /_dev/primitives, a
 * production build renders the app's 404 here (gated in tests/landing/app-create.gates.spec.ts).
 */
export const metadata: Metadata = {
  title: 'Create campaign fixture · DappDrop',
  robots: { index: false, follow: false },
}

export default async function CreateCampaignFixturePage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { state } = await searchParams
  return <CreateCampaignFixture state={state ?? 'index'} />
}
