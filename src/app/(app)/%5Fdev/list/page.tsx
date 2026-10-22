import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ListFixture } from './fixture'

/**
 * /_dev/list?view=campaigns|dashboard&state=…: Builder B's fixture route (08-site phase 2), for
 * screenshots and gates of the wallet-only states (the claim strip, a host's dashboard) without a
 * wallet. All data on it is example data, labelled as such.
 *
 * NEVER shipped in production: a production build renders the app's 404 here (gated in
 * tests/landing/app-list.gates.spec.ts). The folder is `%5Fdev` because Next treats `_dev` as private.
 */
export const metadata: Metadata = {
  title: 'List fixtures · DappDrop',
  robots: { index: false, follow: false },
}

export default async function ListFixturePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  return <ListFixture view={one(sp.view) === 'dashboard' ? 'dashboard' : 'campaigns'} state={one(sp.state)} />
}
