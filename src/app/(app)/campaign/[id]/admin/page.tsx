import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      console.error('Failed to fetch participants', await res.text())
      errorMessage = await res.text()
    }
  } catch (error) {
    console.error('Error fetching admin participants:', error)
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
  }

  return (
    <div className="container mx-auto py-10 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Campaign #{campaignId} - Participants Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Wallet Address</th>
                  <th className="px-6 py-4 font-medium">Discord</th>
                  <th className="px-6 py-4 font-medium">Telegram</th>
                  <th className="px-6 py-4 font-medium text-center">
                    Humanity Verified
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {errorMessage ? (
                  <tr>
                    <td colSpan={4}>Failed to load participants.</td>
                  </tr>
                ) : participants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      No participants found for this campaign.
                    </td>
                  </tr>
                ) : (
                  participants.map((p) => (
                    <tr
                      key={p.walletAddress}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs">
                        {p.walletAddress.slice(0, 6)}...
                        {p.walletAddress.slice(-4)}
                      </td>
                      <td className="px-6 py-4">
                        {p.discordUsername ? (
                          <span className="font-medium text-indigo-500">
                            @{p.discordUsername}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">
                            Not Connected
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {p.telegramUsername ? (
                          <span className="font-medium text-sky-500">
                            @{p.telegramUsername}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">
                            Not Connected
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {p.humanityVerified ? (
                          <Badge
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Verified
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-muted-foreground"
                          >
                            Unverified
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
