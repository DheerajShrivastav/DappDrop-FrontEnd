
'use client';

import { useState, useEffect } from 'react';
import type { Campaign } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Users, Gift, Calendar, Rocket, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { useWallet } from '@/context/wallet-provider';
import { Button } from './ui/button';
import { openCampaign, endCampaign, isPaused } from '@/lib/web3-service';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CampaignCardProps {
  campaign: Campaign;
  onUpdate?: () => void;
}

export function CampaignCard({ campaign, onUpdate }: CampaignCardProps) {
  const { address } = useWallet();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isContractPaused, setIsContractPaused] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<'open' | 'end' | null>(null);

  useEffect(() => {
    const checkPausedState = async () => {
      const paused = await isPaused();
      setIsContractPaused(paused);
    };
    checkPausedState();
  }, []);

  const isHost = address && address.toLowerCase() === campaign.host.toLowerCase();

  const handleAction = async () => {
    if (!actionToConfirm) return;
    setIsUpdating(true);
    setIsDialogOpen(false);
    try {
      if (actionToConfirm === 'open') {
        await openCampaign(campaign.id);
      } else if (actionToConfirm === 'end') {
        await endCampaign(campaign.id);
      }
      if (onUpdate) onUpdate();
    } catch(e) {
      // Error toast is shown in the service
    } finally {
      setIsUpdating(false);
      setActionToConfirm(null);
    }
  }

  const openConfirmationDialog = (action: 'open' | 'end') => {
    setActionToConfirm(action);
    setIsDialogOpen(true);
  }
  
  const getBadgeVariant = () => {
    switch (campaign.status) {
        case 'Active': return 'default';
        case 'Draft': return 'secondary';
        case 'Ended': return 'destructive';
        default: return 'outline';
    }
  }

  return (
    <>
      <Card className="h-full flex flex-col transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:shadow-primary/10 bg-card border-border/50 hover:border-primary/50">
         <Link href={`/campaign/${campaign.id}`} className="block group flex flex-col flex-grow">
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
        </Link>
        <CardFooter className="bg-secondary/50 border-t p-4 flex justify-between items-center">
            <div className="flex items-center text-sm text-muted-foreground">
                <Users className="h-4 w-4 mr-2" />
                <span>{campaign.participants.toLocaleString()} participants</span>
            </div>
            {isHost && onUpdate && (
                <div className="flex items-center gap-2">
                    {campaign.status === 'Draft' && (
                        <Button size="sm" variant="outline" onClick={() => openConfirmationDialog('open')} disabled={isUpdating || isContractPaused} title={isContractPaused ? "Contract is paused" : "Open campaign"}>
                             {isUpdating && actionToConfirm === 'open' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Rocket className="h-4 w-4" />}
                        </Button>
                    )}
                    {campaign.status === 'Active' && (
                        <Button size="sm" variant="destructive" onClick={() => openConfirmationDialog('end')} disabled={isUpdating || isContractPaused} title={isContractPaused ? "Contract is paused" : "End campaign"}>
                            {isUpdating && actionToConfirm === 'end' ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="h-4 w-4" />}
                        </Button>
                    )}
                </div>
            )}
        </CardFooter>
      </Card>
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This action will update the campaign's status on the blockchain. 
                      {actionToConfirm === 'open' && " It will become visible and joinable for all participants."}
                      {actionToConfirm === 'end' && " Participants will no longer be able to join, but can start claiming rewards if they completed the tasks."}
                      This cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAction}>Continue</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    