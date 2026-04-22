
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@/context/wallet-provider';
import { useRouter } from 'next/navigation';
import { Loader2, PlusCircle, BarChart3, Rocket, Users, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

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

  // Calculate statistics
  const totalCampaigns = hostCampaigns.length;
  const activeCampaigns = hostCampaigns.filter(c => c.status === 'Open').length;
  const totalParticipants = hostCampaigns.reduce((acc, curr) => acc + curr.participants, 0);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="container mx-auto px-4 py-12 min-h-screen bg-gradient-soft">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        {/* Header Section */}
        <motion.div variants={item} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Host Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Manage your campaigns and view participant data.
            </p>
          </div>
          <Button asChild size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
            <Link href="/create-campaign">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Campaign
            </Link>
          </Button>
        </motion.div>

        {/* Statistics Cards */}
        <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 dark:from-blue-950/20 dark:to-background dark:border-blue-900/50 shadow-sm hover:shadow-md transition-all duration-300 group">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Campaigns</p>
                <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalCampaigns}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 dark:from-green-950/20 dark:to-background dark:border-green-900/50 shadow-sm hover:shadow-md transition-all duration-300 group">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Active Now</p>
                <h3 className="text-3xl font-bold text-green-600 dark:text-green-400">{activeCampaigns}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                <Rocket className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 dark:from-purple-950/20 dark:to-background dark:border-purple-900/50 shadow-sm hover:shadow-md transition-all duration-300 group">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Participants</p>
                <h3 className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalParticipants.toLocaleString()}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <Users className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Campaigns Grid */}
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Your Campaigns</h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64 bg-card/50 rounded-xl border border-dashed">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : hostCampaigns.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {hostCampaigns.map((campaign, index) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <CampaignCard campaign={campaign} onUpdate={onCampaignUpdate} />
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 bg-card/50 rounded-xl border-2 border-dashed border-muted flex flex-col items-center justify-center"
            >
              <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                <LayoutDashboard className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-8 text-lg">
                Get started by creating your first campaign to engage with your community.
              </p>
              <Button asChild size="lg" className="shadow-lg">
                <Link href="/create-campaign">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Create Your First Campaign
                </Link>
              </Button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
