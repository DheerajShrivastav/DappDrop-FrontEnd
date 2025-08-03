
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { format } from 'date-fns';

import type { Campaign, UserTask, Task as TaskType } from '@/lib/types';
import { useWallet } from '@/context/wallet-provider';
import { useToast } from '@/hooks/use-toast';
import { truncateAddress } from '@/lib/utils';
import { getCampaignById } from '@/lib/web3-service';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar, CheckCircle, Clock, Gift, Loader2, Users, Info, ShieldCheck, Twitter, MessageSquare, Bot, Share2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const TaskIcon = ({ type }: { type: TaskType['type'] }) => {
  switch (type) {
    case 'SOCIAL_FOLLOW': return <Twitter className="h-5 w-5 text-sky-500" />;
    case 'JOIN_DISCORD': return <MessageSquare className="h-5 w-5 text-indigo-500" />;
    case 'RETWEET': return <Twitter className="h-5 w-5 text-sky-400" />;
    case 'ONCHAIN_TX': return <ShieldCheck className="h-5 w-5 text-green-500" />;
    default: return <Bot className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function CampaignDetailsPage() {
  const params = useParams();
  const { id } = params;
  const { isConnected, role, address } = useWallet();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    if (id) {
        const fetchCampaign = async () => {
            const fetchedCampaign = await getCampaignById(id as string);
            if (fetchedCampaign) {
                setCampaign(fetchedCampaign);
                setUserTasks(fetchedCampaign.tasks.map(task => ({ taskId: task.id, completed: false })));
            }
        }
        fetchCampaign();
    }
  }, [id]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        toast({ title: 'Link Copied!', description: 'Campaign link copied to your clipboard.' });
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to copy link.' });
    });
  };

  if (!campaign) {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  const isCampaignEnded = new Date() > campaign.endDate;
  const allTasksCompleted = userTasks.every(task => task.completed);
  const canClaim = isConnected && isJoined && isCampaignEnded && allTasksCompleted;

  const handleCompleteTask = (taskId: string) => {
    if (!isJoined) {
        toast({ variant: 'destructive', title: 'Not Joined', description: 'You must join the campaign before completing tasks.' });
        return;
    }
    setUserTasks(prevTasks =>
      prevTasks.map(task =>
        task.taskId === taskId ? { ...task, isCompleting: true } : task
      )
    );
    // Simulate API call to mark task as complete
    setTimeout(() => {
      setUserTasks(prevTasks =>
        prevTasks.map(task =>
          task.taskId === taskId ? { ...task, completed: true, isCompleting: false } : task
        )
      );
      toast({ title: 'Task Completed!', description: 'Great job, one step closer to your reward.' });
    }, 1500);
  };
  
  const handleJoinCampaign = () => {
    if(!isConnected) {
        toast({ variant: 'destructive', title: 'Wallet Not Connected', description: 'Please connect your wallet to join.' });
        return;
    }
    setIsJoining(true);
    // Simulate smart contract interaction
    setTimeout(() => {
        setIsJoining(false);
        setIsJoined(true);
        toast({ title: 'Success!', description: `You have joined the ${campaign.title} campaign.` });
    }, 1500);
  }

  const handleClaimRewards = () => {
    setIsClaiming(true);
    // Simulate smart contract interaction
    setTimeout(() => {
      setIsClaiming(false);
      toast({ title: 'Congratulations!', description: 'Your rewards have been claimed successfully.' });
    }, 2000);
  };
  
  const completedTasksCount = userTasks.filter(t => t.completed).length;
  const progressPercentage = campaign.tasks.length > 0 ? (completedTasksCount / campaign.tasks.length) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-card border">
             <CardHeader className="p-0">
                <div className="relative h-80 w-full">
                    <Image
                    src={campaign.imageUrl}
                    alt={campaign.title}
                    fill
                    className="object-cover rounded-t-lg"
                    data-ai-hint={campaign['data-ai-hint']}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-3xl font-bold">{campaign.title}</CardTitle>
                    <Button variant="outline" size="icon" onClick={handleShare}>
                        <Share2 className="h-5 w-5" />
                        <span className="sr-only">Share</span>
                    </Button>
                </div>
                <CardDescription className="text-lg text-muted-foreground">{campaign.longDescription}</CardDescription>
            </CardContent>
          </Card>
          
          <Card className="bg-card border">
            <CardHeader><CardTitle>Tasks to Complete</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               {role === 'participant' && (
                  <div className='mb-6'>
                    <div className='flex justify-between items-center mb-2'>
                        <span className='text-sm text-muted-foreground'>Your Progress</span>
                        <span className='text-sm font-semibold'>{completedTasksCount} / {campaign.tasks.length}</span>
                    </div>
                    <Progress value={progressPercentage} className='w-full h-2' />
                  </div>
               )}
              {campaign.tasks.map((task) => {
                const userTask = userTasks.find(ut => ut.taskId === task.id);
                return (
                  <div key={task.id} className="flex items-center justify-between p-4 rounded-md bg-secondary/50">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-background rounded-full">
                        <TaskIcon type={task.type} />
                      </div>
                      <label htmlFor={task.id} className="text-sm font-medium leading-none">
                        {task.description}
                      </label>
                    </div>
                    {role === 'participant' && (
                      <Button
                        size="sm"
                        variant={userTask?.completed ? "ghost" : "outline"}
                        disabled={!isJoined || userTask?.completed || userTask?.isCompleting}
                        onClick={() => handleCompleteTask(task.id)}
                      >
                        {userTask?.isCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {userTask?.completed ? (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Completed
                          </>
                        ) : 'Complete Task'}
                      </Button>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-card border">
            <CardHeader><CardTitle>Campaign Info</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center"><Users className="h-4 w-4 mr-3 text-muted-foreground" /> <span>{campaign.participants.toLocaleString()} participants</span></div>
              <div className="flex items-center"><Calendar className="h-4 w-4 mr-3 text-muted-foreground" /> <span>Ends on {format(campaign.endDate, 'PPP')}</span></div>
              <div className="flex items-center"><Clock className="h-4 w-4 mr-3 text-muted-foreground" /> 
                <Badge variant={isCampaignEnded ? "secondary" : "default"}>
                  {isCampaignEnded ? "Ended" : "Active"}
                </Badge>
              </div>
              <div className="flex items-start font-semibold"><Gift className="h-4 w-4 mr-3 text-primary shrink-0 mt-1" /> 
                <div>
                  <span>Reward: {campaign.reward.name}</span>
                  <p className="text-xs font-normal text-muted-foreground break-all">({campaign.reward.type}: {truncateAddress(campaign.reward.tokenAddress)})</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {role === 'participant' && (
            <Card className="bg-card border sticky top-24">
                <CardHeader><CardTitle>Your Actions</CardTitle></CardHeader>
                <CardContent className='space-y-4'>
                    {!isJoined ? (
                        <Button className="w-full" onClick={handleJoinCampaign} disabled={isJoining || !isConnected || campaign.status !== 'Active'}>
                            {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {campaign.status !== 'Active' ? 'Campaign Not Active' : 'Join Campaign'}
                        </Button>
                    ) : (
                        <Alert variant="default" className="border-green-500 bg-green-500/10">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <AlertTitle className="text-green-600">You've Joined!</AlertTitle>
                            <AlertDescription>Complete the tasks to be eligible for rewards.</AlertDescription>
                        </Alert>
                    )}
                    
                    <Button className="w-full" onClick={handleClaimRewards} disabled={!canClaim || isClaiming} variant="default">
                        {isClaiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Claim Rewards
                    </Button>
                    {!isCampaignEnded && <p className="text-xs text-center text-muted-foreground">Rewards can be claimed after the campaign ends.</p>}
                    {isCampaignEnded && !allTasksCompleted && isJoined && <p className="text-xs text-center text-muted-foreground">Complete all tasks to claim rewards.</p>}
                     {address && isConnected && 
                        <p className="text-xs text-center text-muted-foreground pt-2 break-all">
                            Connected as: {address}
                        </p>
                    }
                </CardContent>
            </Card>
          )}

           {role === 'host' && (
             <Alert>
                <Info className="h-4 w-4"/>
                <AlertTitle>Host View</AlertTitle>
                <AlertDescription>
                    You are viewing this campaign as its host. Participant actions are disabled.
                </AlertDescription>
            </Alert>
           )}
        </div>
      </div>
    </div>
  );
}
