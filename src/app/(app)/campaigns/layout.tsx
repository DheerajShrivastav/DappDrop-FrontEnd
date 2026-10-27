import type { Metadata } from 'next'

// 08-site (APP-05): one <title> per app page. page.tsx is a client component, so it lives here.
export const metadata: Metadata = { title: 'Campaigns · DappDrop' }

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return children
}
