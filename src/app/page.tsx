'use client';

import Link from 'next/link';
import { PlusCircle, Loader2 } from 'lucide-react';
import { CampaignCard } from '@/components/campaign-card';
import { useWallet } from '@/context/wallet-provider';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { getAllCampaigns } from '@/lib/web3-service';
import type { Campaign } from '@/lib/types';

export default function Home() {
  const { role } = useWallet();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setIsLoading(true);
      const fetchedCampaigns = await getAllCampaigns();
      setCampaigns(fetchedCampaigns);
      setIsLoading(false);
    };

    fetchCampaigns();
  }, []);


  return (
    <>
      <section className="bg-card border-b">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-10 duration-700">
            Welcome to DApp Drop Zone
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
            The ultimate platform to create, manage, and participate in exciting airdrop campaigns on the blockchain. Discover new projects and get rewarded.
          </p>
          <div className="mt-8 flex justify-center gap-4 animate-in fade-in slide-in-from-bottom-14 duration-700 delay-400">
            <Button size="lg" asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="#campaigns">Explore Campaigns</Link>
            </Button>
            {role === 'host' && (
              <Button size="lg" variant="outline" asChild>
                <Link href="/create-campaign">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Create Your Campaign
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <div id="campaigns" className="container mx-auto px-4 py-16">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Active Campaigns</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
