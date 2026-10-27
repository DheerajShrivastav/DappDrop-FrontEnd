import type { Metadata } from 'next'

// 08-site (APP-05): one <title> per app page. Internal: kept out of search results too.
export const metadata: Metadata = { title: 'Admin · DappDrop', robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
