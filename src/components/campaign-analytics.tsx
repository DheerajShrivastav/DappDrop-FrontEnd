'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Campaign, ParticipantData } from '@/lib/types'
import { truncateAddress } from '@/lib/utils'
import { isSelfReportedTask } from '@/lib/task-types'
import { SelfReportedBadge } from '@/components/self-reported-badge'

interface CampaignAnalyticsProps {
  campaign: Campaign
  participants: ParticipantData[]
  participantAddresses: string[]
  isLoading: boolean
}

export function CampaignAnalytics({
  campaign,
  participants,
  participantAddresses,
  isLoading,
}: CampaignAnalyticsProps) {
  // Participants' self-entered X handles, from a host-only route — for spot-checking
  // self-reported tasks. Unverified; labelled so. (Before any early return: hook rules.)
  const [xHandles, setXHandles] = useState<Record<string, string>>({})
  const addressKey = participants.map((p) => p.address.toLowerCase()).sort().join(',')
  useEffect(() => {
    if (!addressKey) return
    let cancelled = false
    fetch(`/api/campaigns/${campaign.id}/participant-x-handles?addresses=${encodeURIComponent(addressKey)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { handles: {} }))
      .then((d) => !cancelled && setXHandles(d.handles ?? {}))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [campaign.id, addressKey])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  // Check both the detailed participants array and the blockchain participant count
  if (participants.length === 0 && campaign.participants === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No participants have joined this campaign yet.
      </p>
    )
  }

  // If we have participants on blockchain but no detailed data, show basic addresses
  if (participants.length === 0 && campaign.participants > 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start sm:items-center justify-between space-y-0 gap-4 pb-4">
          <div className="space-y-1">
            <CardTitle>Campaign Participants</CardTitle>
            <CardDescription>
              {campaign.participants} participant
              {campaign.participants > 1 ? 's' : ''} joined this campaign.
              {participantAddresses.length === 0 &&
                ' Loading participant data...'}
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href={`/campaign/${campaign.id}/admin`}>
              View Detailed Participant Info
            </Link>
          </Button>
        </CardHeader>
        {participantAddresses.length > 0 && (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant Address</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantAddresses.map((address, index) => (
                  <TableRow key={address}>
                    <TableCell className="font-mono text-sm">
                      {truncateAddress(address)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">Joined</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    )
  }

  const selfReportedCount = campaign.tasks.filter((t) => isSelfReportedTask(t.type)).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-start sm:items-center justify-between space-y-0 pb-4 gap-4">
        <div className="space-y-1">
          <CardTitle>Participant Analytics</CardTitle>
          <CardDescription>
            A detailed view of your campaign participants, task completion
            rates, and reward distribution status.
          </CardDescription>
          {selfReportedCount > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <SelfReportedBadge />
              {selfReportedCount} of {campaign.tasks.length} task
              {campaign.tasks.length === 1 ? ' is' : 's are'} confirmed by participants themselves, so
              completion counts include unverified tasks.
            </p>
          )}
        </div>
        <Button asChild variant="outline">
          <Link href={`/campaign/${campaign.id}/admin`}>
            View Detailed Participant Info
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participant Address</TableHead>
              <TableHead>
                X handle <span className="font-normal text-muted-foreground">(unverified)</span>
              </TableHead>
              <TableHead className="text-center">Tasks Completed</TableHead>
              <TableHead className="text-center">Reward Claimed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((p) => (
              <TableRow key={p.address}>
                <TableCell className="font-mono">
                  {truncateAddress(p.address)}
                </TableCell>
                <TableCell>
                  {xHandles[p.address.toLowerCase()] ? (
                    <a
                      href={`https://x.com/${xHandles[p.address.toLowerCase()]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      @{xHandles[p.address.toLowerCase()]}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {p.tasksCompleted} / {campaign.tasks.length}
                </TableCell>
                <TableCell className="text-center">
                  {p.claimed ? (
                    <Badge variant="default" className="bg-green-600/80">
                      <CheckCircle className="h-4 w-4 mr-1" /> Yes
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-4 w-4 mr-1" /> No
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
