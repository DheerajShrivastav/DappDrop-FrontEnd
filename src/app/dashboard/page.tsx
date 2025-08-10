
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@/context/wallet-provider';
import { useRouter } from 'next/navigation';
import { Loader2, PlusCircle } from 'lucide-react';
import Link from 'next/link';

import type { Campaign } from '@/lib/types';
import { getCampaignsByHostAddress } from '@/lib/web3-service';
import { CampaignCard } from '@/components/campaign-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  const { address, role, isConnected } = useWallet();
  const router = useRouter();
  const { toast } = useToast();
  const [hostCampaigns, setHostCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHostCampaigns = useCallback(async () => {
    if (role === 'host' && address) {
      setIsLoading(true);
      const fetchedCampaigns = await getCampaignsByHostAddress(address);
      setHostCampaigns(fetchedCampaigns);
      setIsLoading(false);
    }
  }, [role, address]);
  
  useEffect(() => {
    if (!isConnected) {
        toast({
            variant: 'destructive',
            title: 'Unauthorized',
            description: 'Please connect your wallet to view this page.'
        });
        router.push('/');
        return;
    }
    if (role && role !== 'host') {
        toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: 'You do not have permission to view this page.'
        });
        router.push('/');
        return;
    }
    if (role === 'host') {
        fetchHostCampaigns();
    }
  }, [isConnected, role, router, toast, fetchHostCampaigns]);

  const onCampaignUpdate = () => {
    fetchHostCampaigns();
  };
  
  if (!role) {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Host Dashboard</h1>
          <p className="text-muted-foreground">Manage your campaigns and view participant data.</p>
        </div>
        <Button asChild>
          <Link href="/create-campaign">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Campaign
          </Link>
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Campaigns</CardTitle>
          <CardDescription>
            Here are all the campaigns you've created. Click a campaign to view its analytics and manage it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
          ) : hostCampaigns.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {hostCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} onUpdate={onCampaignUpdate} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-background rounded-lg border-2 border-dashed">
              <h3 className="text-xl font-semibold">You haven't created any campaigns yet.</h3>
              <p className="text-muted-foreground mt-2 mb-4">Get started by creating your first campaign.</p>
              <Button asChild>
                <Link href="/create-campaign">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Create Your Campaign
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
