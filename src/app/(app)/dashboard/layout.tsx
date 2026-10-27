import type { Metadata } from 'next'

// 08-site (APP-05): one <title> per app page. page.tsx is a client component, so it lives here.
export const metadata: Metadata = { title: 'Dashboard · DappDrop' }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
