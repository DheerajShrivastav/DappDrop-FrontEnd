import type { Metadata } from 'next'

/**
 * 08-site (APP-05): the campaign page's <title>. The server only knows the id ("Campaign #12 ·
 * DappDrop"): fetching the name here would put the indexer on the page's critical path. Once the
 * client page has loaded the campaign, it upgrades the title to "<Campaign name> · DappDrop"
 * with `useDocumentTitle` from '@/components/app' (phase 2 wires that in the page body).
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const safe = /^\d{1,10}$/.test(id) ? id : null
  return { title: safe ? `Campaign #${safe} · DappDrop` : 'Campaign · DappDrop' }
}

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return children
}
