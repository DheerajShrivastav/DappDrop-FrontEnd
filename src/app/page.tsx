
'use client';

import Link from 'next/link';
import { PlusCircle, Loader2, Rocket, Zap, Award, Twitter, Github, Bot, ShieldCheck, DollarSign, Image as ImageIcon } from 'lucide-react';
import { CampaignCard } from '@/components/campaign-card';
import { useWallet } from '@/context/wallet-provider';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { getAllCampaigns } from '@/lib/web3-service';
import type { Campaign } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
            <div className="bg-primary/10 rounded-full px-4 py-1.5 text-sm text-primary inline-block mb-4 animate-in fade-in slide-in-from-bottom-8 duration-700 shadow-lg shadow-primary/20">
                Find The Next Billion Real Users For Your Project
            </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-foreground animate-in fade-in slide-in-from-bottom-10 duration-700">
            A New Era of Community Building
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
            The ultimate platform to launch your project, engage real users, and build a thriving community on-chain. Ditch the bots, find your tribe.
          </p>
          <div className="mt-8 flex justify-center gap-4 animate-in fade-in slide-in-from-bottom-14 duration-700 delay-400">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
              <Link href="#campaigns">Explore Campaigns</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/create-campaign">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Your Campaign
              </Link>
            </Button>
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
                    <h3 className="text-xl font-semibold mb-2">Launch Your Campaign</h3>
                    <p className="text-muted-foreground">Easily create and customize campaigns to attract and onboard your ideal users.</p>
                </div>
                <div className="flex flex-col items-center">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <Zap className="h-8 w-8 text-primary"/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Engage Real Users</h3>
                    <p className="text-muted-foreground">Participants discover new projects, complete meaningful tasks, and prove their engagement.</p>
                </div>
                 <div className="flex flex-col items-center">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <Award className="h-8 w-8 text-primary"/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Grow Your Community</h3>
                    <p className="text-muted-foreground">Reward genuine participation and turn new users into a valuable, long-term community.</p>
                </div>
            </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold tracking-tight text-center mb-4">Engage Your Way</h2>
            <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
              From simple social tasks to complex on-chain actions, design campaigns that create genuine engagement and reward users with valuable digital assets.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <Card className="bg-card border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-2xl">Tasks for Real Engagement</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-2 rounded-lg mt-1"><Twitter className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-semibold">Social Follows</h4>
                                <p className="text-sm text-muted-foreground">Grow your community on platforms like X (formerly Twitter).</p>
                            </div>
                       </div>
                       <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-2 rounded-lg mt-1"><Github className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-semibold">GitHub Repo Stars</h4>
                                <p className="text-sm text-muted-foreground">Encourage developers to engage with your open-source code.</p>
                            </div>
                       </div>
                       <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-2 rounded-lg mt-1"><Bot className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-semibold">Join Discord / Telegram</h4>
                                <p className="text-sm text-muted-foreground">Funnel engaged users directly into your community channels.</p>
                            </div>
                       </div>
                       <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-2 rounded-lg mt-1"><ShieldCheck className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-semibold">On-Chain Actions</h4>
                                <p className="text-sm text-muted-foreground">Verify wallet balances, token holds, or specific contract interactions.</p>
                            </div>
                       </div>
                    </CardContent>
                </Card>
                 <Card className="bg-card border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-2xl">Rewards That Matter</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-2 rounded-lg mt-1"><ImageIcon className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-semibold">On-Chain NFTs</h4>
                                <p className="text-sm text-muted-foreground">Reward loyal users with unique, verifiable digital collectibles (ERC721).</p>
                            </div>
                       </div>
                       <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-2 rounded-lg mt-1"><DollarSign className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-semibold">Cryptocurrency</h4>
                                <p className="text-sm text-muted-foreground">Distribute your project's native token or other popular tokens (ERC20).</p>
                            </div>
                       </div>
                       <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-2 rounded-lg mt-1"><Award className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-semibold">Exclusive Roles & Access</h4>
                                <p className="text-sm text-muted-foreground">Grant special Discord roles or access to token-gated content.</p>
                            </div>
                       </div>
                       <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-2 rounded-lg mt-1"><Zap className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-semibold">And More...</h4>
                                <p className="text-sm text-muted-foreground">Our flexible system allows for a wide range of creative reward structures.</p>
                            </div>
                       </div>
                    </CardContent>
                </Card>
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
            <p className="text-muted-foreground mt-2">Check back later for new opportunities to engage!</p>
          </div>
        )}
      </div>
    </>
  );
}
