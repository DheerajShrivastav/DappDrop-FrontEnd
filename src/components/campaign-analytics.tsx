'use client'

import { Loader2, CheckCircle, XCircle } from 'lucide-react'
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
        <CardHeader>
          <CardTitle>Campaign Participants</CardTitle>
          <CardDescription>
            {campaign.participants} participant
            {campaign.participants > 1 ? 's' : ''} joined this campaign.
            {participantAddresses.length === 0 &&
              ' Loading participant data...'}
          </CardDescription>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participant Analytics</CardTitle>
        <CardDescription>
          A detailed view of your campaign participants, task completion rates,
          and reward distribution status.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participant Address</TableHead>
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
