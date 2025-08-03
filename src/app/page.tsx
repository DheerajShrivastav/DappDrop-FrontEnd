
'use client';

import Link from 'next/link';
import { PlusCircle, Loader2, Rocket, Zap, Award } from 'lucide-react';
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
      <section className="bg-background border-b border-primary/20">
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="bg-primary/10 rounded-full px-4 py-1.5 text-sm text-primary-foreground inline-block mb-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            The Future of Community Engagement is Here
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-foreground animate-in fade-in slide-in-from-bottom-10 duration-700">
            DApp Drop Zone
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
            The ultimate platform to create, manage, and participate in exciting airdrop campaigns on the blockchain. Discover new projects and get rewarded.
          </p>
          <div className="mt-8 flex justify-center gap-4 animate-in fade-in slide-in-from-bottom-14 duration-700 delay-400">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
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

      <section className="py-20 bg-card border-b border-t">
        <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold tracking-tight text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-12 text-center">
                <div className="flex flex-col items-center">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <Rocket className="h-8 w-8 text-primary"/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Launch Campaigns</h3>
                    <p className="text-muted-foreground">Hosts can easily create and customize airdrop campaigns to engage their community and distribute tokens.</p>
                </div>
                <div className="flex flex-col items-center">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <Zap className="h-8 w-8 text-primary"/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Complete Tasks</h3>
                    <p className="text-muted-foreground">Participants discover new projects, complete on-chain and off-chain tasks, and prove their engagement.</p>
                </div>
                 <div className="flex flex-col items-center">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <Award className="h-8 w-8 text-primary"/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Earn Rewards</h3>
                    <p className="text-muted-foreground">Successfully completed tasks make participants eligible to claim valuable token rewards directly to their wallet.</p>
                </div>
            </div>
        </div>
      </section>

      <div id="campaigns" className="container mx-auto px-4 py-20">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Active Campaigns</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          </div>
        ) : campaigns.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-lg border-2 border-dashed">
            <h3 className="text-xl font-semibold">No Active Campaigns</h3>
            <p className="text-muted-foreground mt-2">Check back later for new airdrop opportunities!</p>
          </div>
        )}
      </div>
    </>
  );
}
