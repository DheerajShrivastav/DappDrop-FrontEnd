import type { Metadata } from 'next'

// 08-site (APP-05): one <title> per app page. An OAuth landing step, never a search result.
export const metadata: Metadata = { title: 'Verifying · DappDrop', robots: { index: false, follow: false } }

export default function HumanityCallbackLayout({ children }: { children: React.ReactNode }) {
  return children
}
