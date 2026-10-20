import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { Chip } from '@/components/app/chip'
import { PageContainer, PageHeader } from '@/components/app/page-header'
import { shortAddress } from '@/components/app/format'
import { verifyWalletSession } from '@/app/lib/dal'
import { getCampaignById } from '@/lib/web3-service'

// Interfaces for our merged data
interface Participant {
  walletAddress: string
  discordUsername: string | null
  telegramUsername: string | null
  humanityVerified: boolean
}

// React Server Component
export default async function CampaignAdminPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const campaignId = resolvedParams.id

  if (!campaignId) {
    notFound()
  }

  let session
  try {
    session = await verifyWalletSession()
  } catch (error) {
    console.error('Unauthorized access to Campaign Admin Page:', error)
    notFound()
  }

  // Fetch campaign to verify the user is the host
  const campaign = await getCampaignById(campaignId)

  if (!campaign) {
    notFound()
  }

  if (campaign.host.toLowerCase() !== session.walletAddress.toLowerCase()) {
    console.error(
      `User ${session.walletAddress} attempted to access admin page for campaign ${campaignId} hosted by ${campaign.host}`,
    )
    notFound()
  }

  // Fetch the data from our new API route
  // Using absolute URL for server-side fetch in Next.js App Router
  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')

  let participants: Participant[] = []
  let errorMessage: string | null = null
  try {
    const res = await fetch(
      `${appUrl}/api/campaigns/${campaignId}/participants`,
      {
        cache: 'no-store', // ensures fresh data on every load for admin dashboard
      },
    )

    if (res.ok) {
      participants = await res.json()
    } else {
      const errorText = await res.text()
      console.error('Failed to fetch participants', errorText)
      errorMessage = errorText
    }
  } catch (error) {
    console.error('Error fetching admin participants:', error)
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
  }

  return (
    <PageContainer>
      <PageHeader
        size="md"
        back={{ href: `/campaign/${campaignId}`, label: `Campaign #${campaignId}` }}
        eyebrow="Host only"
        title="Participants"
        lead="Who joined, and the accounts they linked. Only the host of this campaign can open this page."
      />
      <div className="mt-10 overflow-x-auto rounded-[10px] border border-rule" tabIndex={0} role="region" aria-label="Participants">
        <table className="w-full text-left text-small">
          <thead>
            <tr className="border-b border-rule font-mono text-[0.75rem] uppercase tracking-[0.08em] text-ink-2">
              <th scope="col" className="px-5 py-3 font-normal">Wallet</th>
              <th scope="col" className="px-5 py-3 font-normal">Discord</th>
              <th scope="col" className="px-5 py-3 font-normal">Telegram</th>
              <th scope="col" className="px-5 py-3 font-normal">Humanity check</th>
            </tr>
          </thead>
          <tbody>
            {errorMessage ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-ink-2">
                  <span aria-hidden="true" className="mr-2 font-mono font-semibold text-danger">!</span>
                  We couldn’t load the participants. Refresh to try again.
                </td>
              </tr>
            ) : participants.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-ink-2">
                  Nobody has joined this campaign yet.
                </td>
              </tr>
            ) : (
              participants.map((p) => (
                <tr key={p.walletAddress} className="border-b border-rule last:border-0">
                  <td className="px-5 py-3 font-mono text-[0.8125rem] text-ink" title={p.walletAddress}>
                    {shortAddress(p.walletAddress)}
                  </td>
                  <td className="px-5 py-3">{p.discordUsername ? <span className="text-ink">@{p.discordUsername}</span> : <span className="text-ink-2">Not linked</span>}</td>
                  <td className="px-5 py-3">{p.telegramUsername ? <span className="text-ink">@{p.telegramUsername}</span> : <span className="text-ink-2">Not linked</span>}</td>
                  <td className="px-5 py-3">
                    {p.humanityVerified ? (
                      <Chip variant="check" mark="✓">Verified</Chip>
                    ) : (
                      <Chip variant="neutral">Not verified</Chip>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  )
}
