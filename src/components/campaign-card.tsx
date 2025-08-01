'use client';

import type { Campaign } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Users } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cva } from 'class-variance-authority';

interface CampaignCardProps {
  campaign: Campaign;
}

const statusBadgeVariants = cva(
  "absolute top-4 right-4",
  {
    variants: {
      status: {
        Draft: "bg-yellow-500 text-white",
        Active: "bg-primary text-primary-foreground",
        Ended: "bg-secondary text-secondary-foreground",
      },
    },
    defaultVariants: {
      status: "Active",
    },
  }
);

export function CampaignCard({ campaign }: CampaignCardProps) {
  const getBadgeVariant = () => {
    switch (campaign.status) {
      case 'Active':
        return 'default';
      case 'Ended':
        return 'secondary';
      case 'Draft':
        return 'outline';
      default:
        return 'default';
    }
  }

  return (
    <Link href={`/campaign/${campaign.id}`} className="block group">
      <Card className="h-full flex flex-col transition-all duration-300 ease-in-out group-hover:shadow-lg group-hover:-translate-y-1 bg-card">
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
              variant={getBadgeVariant()}
              className="absolute top-4 right-4"
            >
              {campaign.status}
            </Badge>
          </div>
        </CardHeader>
        <div className="p-6 flex flex-col flex-grow">
          <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">{campaign.title}</CardTitle>
          <CardDescription>{campaign.description}</CardDescription>
        </div>
        <CardFooter className="mt-auto">
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-2" />
            <span>{campaign.participants.toLocaleString()} participants</span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
