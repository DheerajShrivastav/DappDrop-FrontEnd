
'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Campaign } from '@/lib/types';
import { getCampaignParticipants } from '@/lib/web3-service';
import { truncateAddress } from '@/lib/utils';

interface CampaignAnalyticsProps {
  campaign: Campaign;
}

interface ParticipantData {
  address: string;
  tasksCompleted: number;
  claimed: boolean;
}

export function CampaignAnalytics({ campaign }: CampaignAnalyticsProps) {
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchParticipants = async () => {
      setIsLoading(true);
      const data = await getCampaignParticipants(campaign.id);
      setParticipants(data);
      setIsLoading(false);
    };

    fetchParticipants();
  }, [campaign.id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (participants.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No participants have joined this campaign yet.</p>;
  }

  return (
    <Card>
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
                <TableCell className="font-mono">{truncateAddress(p.address)}</TableCell>
                <TableCell className="text-center">
                  {p.tasksCompleted} / {campaign.tasks.length}
                </TableCell>
                <TableCell className="text-center">
                    {p.claimed ? (
                        <Badge variant="default" className="bg-green-600/80">
                            <CheckCircle className="h-4 w-4 mr-1"/> Yes
                        </Badge>
                    ) : (
                        <Badge variant="secondary">
                           <XCircle className="h-4 w-4 mr-1"/> No
                        </Badge>
                    )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
