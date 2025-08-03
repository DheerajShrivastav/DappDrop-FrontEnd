'use client';

import type { Campaign } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Users, Gift, Calendar } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {

  return (
    <Link href={`/campaign/${campaign.id}`} className="block group">
      <Card className="h-full flex flex-col transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:shadow-primary/10 group-hover:-translate-y-1 bg-card border-border/50 hover:border-primary/50">
        <CardHeader className="p-0">
          <div className="relative h-48 w-full">
            <Image
              src={campaign.imageUrl}
              alt={campaign.title}
              fill
              className="object-cover rounded-t-lg"
              data-ai-hint={campaign['data-ai-hint']}
            />
             <Badge
              variant={campaign.status === 'Active' ? 'default' : 'secondary'}
              className="absolute top-4 right-4 shadow-lg"
            >
              {campaign.status}
            </Badge>
          </div>
        </CardHeader>
        <div className="p-6 flex flex-col flex-grow">
          <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">{campaign.title}</CardTitle>
          <CardDescription className="line-clamp-2">{campaign.description}</CardDescription>
          
          <div className="mt-4 flex-grow flex flex-col justify-end space-y-3 text-sm">
            <div className="flex items-center text-muted-foreground">
                <Gift className="h-4 w-4 mr-2 text-primary" />
                <span>Reward: {campaign.reward.name}</span>
            </div>
             <div className="flex items-center text-muted-foreground">
                <Calendar className="h-4 w-4 mr-2 text-primary" />
                <span>Ends on: {format(campaign.endDate, 'MMM dd, yyyy')}</span>
            </div>
          </div>
        </div>
        <CardFooter className="bg-card border-t p-4">
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-2" />
            <span>{campaign.participants.toLocaleString()} participants</span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
