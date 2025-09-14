'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { format } from 'date-fns'
import Link from 'next/link'

import type {
  Campaign,
  UserTask,
  Task as TaskType,
  ParticipantData,
} from '@/lib/types'
import { useWallet } from '@/context/wallet-provider'
import { useToast } from '@/hooks/use-toast'
import { truncateAddress } from '@/lib/utils'
import {
  getCampaignByIdWithMetadata,
  hasParticipated,
  getCampaignParticipants,
  openCampaign,
  completeTask,
} from '@/lib/web3-service'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Calendar,
  CheckCircle,
  Clock,
  Gift,
  Loader2,
  Users,
  Info,
  ShieldCheck,
  Twitter,
  MessageSquare,
  Bot,
  Share2,
  Award,
  Trophy,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { CampaignAnalytics } from '@/components/campaign-analytics'
import { DiscordAuthButton } from '@/components/discord-auth-button'
import { TaskVerificationForm } from '@/components/task-verification-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TaskIcon = ({ type }: { type: TaskType['type'] }) => {
  switch (type) {
    case 'SOCIAL_FOLLOW':
      return <Twitter className="h-5 w-5 text-sky-500" />
    case 'JOIN_DISCORD':
      return <MessageSquare className="h-5 w-5 text-indigo-500" />
    case 'RETWEET':
      return <Twitter className="h-5 w-5 text-sky-400" />
    case 'ONCHAIN_TX':
      return <ShieldCheck className="h-5 w-5 text-green-500" />
    default:
      return <Bot className="h-5 w-5 text-muted-foreground" />
  }
}

export default function CampaignDetailsPage() {
  const params = useParams()
  const { id } = params
  const { isConnected, role, address } = useWallet()
  const { toast } = useToast()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [userTasks, setUserTasks] = useState<UserTask[]>([])
  const [isClaiming, setIsClaiming] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [participants, setParticipants] = useState<ParticipantData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isActivating, setIsActivating] = useState(false)

  // Winner selection state
  const [numberOfWinners, setNumberOfWinners] = useState(1)
  const [selectionMethod, setSelectionMethod] = useState<
    'random' | 'first' | 'last'
  >('random')
  const [selectedWinners, setSelectedWinners] = useState<string[]>([])
  const [isWinnerDialogOpen, setIsWinnerDialogOpen] = useState(false)

  // Discord Verification State
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
  const [discordUserData, setDiscordUserData] = useState<{
    id: string
    username: string
    discriminator?: string
  } | null>(null)
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null)

  const campaignId = id as string

  const fetchAllCampaignData = useCallback(async () => {
    if (!campaignId) return

    setIsLoading(true)
    const fetchedCampaign = await getCampaignByIdWithMetadata(campaignId)
    console.log('Fetched campaign data:', {
      id: campaignId,
      status: fetchedCampaign?.status,
      startDate: fetchedCampaign?.startDate,
      endDate: fetchedCampaign?.endDate,
      isConnected,
      address,
    })

    if (fetchedCampaign) {
      setCampaign(fetchedCampaign)
      setUserTasks(
        fetchedCampaign.tasks.map((task) => ({
          taskId: task.id,
          completed: false,
        }))
      )

      if (address && isConnected) {
        const hasJoined = await hasParticipated(campaignId, address)
        setIsJoined(hasJoined)
      }

      // Fetch analytics data if the current user is the host
      if (
        role === 'host' &&
        address?.toLowerCase() === fetchedCampaign.host.toLowerCase()
      ) {
        const data = await getCampaignParticipants(fetchedCampaign)
        setParticipants(data)
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Campaign Not Found',
        description: 'Could not load data for this campaign.',
      })
    }
    setIsLoading(false)
  }, [campaignId, address, isConnected, role, toast])

  useEffect(() => {
    fetchAllCampaignData()
  }, [fetchAllCampaignData])

  // Load any previously stored Discord verifications on component mount
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      campaign?.id &&
      campaign.tasks?.length > 0
    ) {
      // Check local storage for previous Discord verifications
      campaign.tasks.forEach((task, index) => {
        if (task.type === 'JOIN_DISCORD') {
          const storedVerification = localStorage.getItem(
            `discord_verification_${campaign.id}_${task.id}`
          )
          if (storedVerification) {
            try {
              const verificationData = JSON.parse(storedVerification)
              // Update completed tasks if we have a stored verification
              if (verificationData.verified) {
                setUserTasks((prevTasks) =>
                  prevTasks.map((t) =>
                    t.taskId === task.id ? { ...t, completed: true } : t
                  )
                )
              }
            } catch (e) {
              console.error('Error parsing stored verification:', e)
            }
          }
        }
      })
    }
  }, [campaign?.id, campaign?.tasks])

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast({
          title: 'Link Copied!',
          description: 'Campaign link copied to your clipboard.',
        })
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err)
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to copy link.',
        })
      })
  }

  const handleSelectWinners = () => {
    if (!campaign) return
    const eligibleParticipants = participants.filter(
      (p) => p.tasksCompleted >= campaign.tasks.length
    )

    if (eligibleParticipants.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No eligible participants',
        description: 'No one has completed all the required tasks yet.',
      })
      return
    }

    if (numberOfWinners > eligibleParticipants.length) {
      toast({
        variant: 'destructive',
        title: 'Not enough participants',
        description: `You requested ${numberOfWinners} winners, but only ${eligibleParticipants.length} are eligible.`,
      })
      return
    }

    let winners: ParticipantData[] = []

    switch (selectionMethod) {
      case 'first':
        winners = eligibleParticipants.slice(0, numberOfWinners)
        break
      case 'last':
        winners = eligibleParticipants.slice(-numberOfWinners)
        break
      case 'random':
        const shuffled = [...eligibleParticipants].sort(
          () => 0.5 - Math.random()
        )
        winners = shuffled.slice(0, numberOfWinners)
        break
    }

    setSelectedWinners(winners.map((p) => p.address))
    setIsWinnerDialogOpen(true)
  }

  if (isLoading || !campaign) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    )
  }

  const allTasksCompleted = userTasks.every((task) => task.completed)
  const canClaim =
    isConnected && isJoined && campaign.status === 'Ended' && allTasksCompleted
  const isHostView =
    role === 'host' && address?.toLowerCase() === campaign.host.toLowerCase()

  const handleCompleteTask = async (
    taskId: string,
    taskType: TaskType['type'],
    discordData?: any
  ) => {
    if (!isConnected || !address) {
      toast({
        variant: 'destructive',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet.',
      })
      return
    }

    setUserTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.taskId === taskId ? { ...task, isCompleting: true } : task
      )
    )

    try {
      // For Discord tasks, check if we have stored verification data if no discordData is provided
      if (taskType === 'JOIN_DISCORD' && !discordData) {
        const storedVerification = localStorage.getItem(
          `discord_verification_${campaignId}_${taskId}`
        )
        if (storedVerification) {
          try {
            discordData = JSON.parse(storedVerification)
            console.log('Using stored Discord verification data:', discordData)
          } catch (e) {
            console.error('Error parsing stored verification:', e)
          }
        }
      }

      // Format discord username with discriminator if available
      const discordUsername =
        discordData?.username && discordData?.discriminator
          ? `${discordData.username}#${discordData.discriminator}`
          : discordData?.username || null

      // All tasks now call our backend API for verification/completion
      const response = await fetch('/api/verify-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          taskId,
          userAddress: address,
          discordUsername,
          discordId: discordData?.id || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success || !result.verified) {
        throw new Error(result.error || 'Verification failed.')
      }

      // Backend verification successful - now complete the task on blockchain
      await completeTask(campaignId, parseInt(taskId), address)

      toast({
        title: 'Task Completed!',
        description: 'Great job, one step closer to your reward.',
      })

      setUserTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.taskId === taskId
            ? { ...task, completed: true, isCompleting: false }
            : task
        )
      )

      // Store successful verification in localStorage for Discord tasks
      if (taskType === 'JOIN_DISCORD' && discordData) {
        localStorage.setItem(
          `discord_verification_${campaignId}_${taskId}`,
          JSON.stringify({
            username: discordData.username,
            id: discordData.id,
            verified: true,
            timestamp: new Date().toISOString(),
          })
        )
      }

      if (!isJoined) {
        setIsJoined(true)
      }
    } catch (error: any) {
      const description = error.message.includes('not in active period')
        ? 'This campaign is not currently active.'
        : error.message || 'Failed to complete task.'
      toast({ variant: 'destructive', title: 'Error', description })
    } finally {
      setUserTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.taskId === taskId ? { ...task, isCompleting: false } : task
        )
      )
      setIsVerifyDialogOpen(false)
      setVerifyingTaskId(null)
      setDiscordUserData(null)
    }
  }

  const handleClaimRewards = () => {
    setIsClaiming(true)
    // Simulate smart contract interaction
    setTimeout(() => {
      setIsClaiming(false)
      toast({
        title: 'Congratulations!',
        description: 'Your rewards have been claimed successfully.',
      })
    }, 2000)
  }

  const handleActivateCampaign = async () => {
    if (!campaign || !isConnected) return

    setIsActivating(true)
    try {
      await openCampaign(campaign.id, toast)
      // Refresh campaign data after activation
      await fetchAllCampaignData()
    } catch (error) {
      console.error('Failed to activate campaign:', error)
    } finally {
      setIsActivating(false)
    }
  }

  const completedTasksCount = userTasks.filter((t) => t.completed).length
  const progressPercentage =
    campaign.tasks.length > 0
      ? (completedTasksCount / campaign.tasks.length) * 100
      : 0

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
                <CardTitle className="text-3xl font-bold">
                  {campaign.title}
                </CardTitle>
                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 className="h-5 w-5" />
                  <span className="sr-only">Share</span>
                </Button>
              </div>
              <CardDescription className="text-lg text-muted-foreground">
                {campaign.longDescription}
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-card border">
            <CardHeader>
              <CardTitle>Tasks to Complete</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {role === 'participant' && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">
                      Your Progress
                    </span>
                    <span className="text-sm font-semibold">
                      {completedTasksCount} / {campaign.tasks.length}
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="w-full h-2" />
                </div>
              )}
              {campaign.tasks.map((task) => {
                const userTask = userTasks.find((ut) => ut.taskId === task.id)
                const isTaskDisabled =
                  userTask?.completed ||
                  userTask?.isCompleting ||
                  campaign.status !== 'Open'

                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 rounded-md bg-secondary/50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-background rounded-full">
                        <TaskIcon type={task.type} />
                      </div>
                      <label
                        htmlFor={`task-${task.id}`}
                        className="text-sm font-medium leading-none"
                      >
                        {task.description}
                      </label>
                    </div>
                    {role === 'participant' && (
                      <div className="flex items-center gap-2">
                        {userTask?.completed ? (
                          <Button
                            id={`task-${task.id}`}
                            size="sm"
                            variant="ghost"
                            disabled
                          >
                            <CheckCircle className="mr-2 h-4 w-4 text-green-500" />{' '}
                            Completed
                          </Button>
                        ) : task.type === 'JOIN_DISCORD' ? (
                          <>
                            <Button size="sm" asChild variant="outline">
                              <Link
                                href={
                                  task.discordInviteLink
                                    ? task.discordInviteLink.startsWith('http')
                                      ? task.discordInviteLink
                                      : `https://discord.gg/${task.discordInviteLink}`
                                    : `https://discord.gg/${
                                        task.verificationData || 'placeholder'
                                      }`
                                }
                                target="_blank"
                              >
                                Join
                              </Link>
                            </Button>
                            <Button
                              id={`task-${task.id}`}
                              size="sm"
                              variant="outline"
                              disabled={isTaskDisabled}
                              onClick={() => {
                                setVerifyingTaskId(task.id)
                                setIsVerifyDialogOpen(true)
                              }}
                            >
                              {userTask?.isCompleting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <ShieldCheck className="mr-2 h-4 w-4" />
                              )}
                              Verify
                            </Button>
                          </>
                        ) : (
                          <Button
                            id={`task-${task.id}`}
                            size="sm"
                            variant="outline"
                            disabled={isTaskDisabled}
                            onClick={() =>
                              handleCompleteTask(task.id, task.type)
                            }
                          >
                            {userTask?.isCompleting && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Complete Task
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {isHostView && (
            <Card className="bg-card border">
              <CardHeader>
                <CardTitle>Host Controls & Analytics</CardTitle>
                <CardDescription>
                  View participant data and manage your campaign.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Trophy className="h-5 w-5 text-primary" /> Select Winners
                    </CardTitle>
                    <CardDescription>
                      Pick winners from eligible participants who have completed
                      all tasks.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-end gap-4">
                    <div className="flex-1">
                      <Label htmlFor="num-winners">Number of Winners</Label>
                      <Input
                        id="num-winners"
                        type="number"
                        min="1"
                        value={numberOfWinners}
                        onChange={(e) =>
                          setNumberOfWinners(parseInt(e.target.value, 10))
                        }
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="selection-method">Selection Method</Label>
                      <Select
                        value={selectionMethod}
                        onValueChange={(value) =>
                          setSelectionMethod(value as any)
                        }
                      >
                        <SelectTrigger id="selection-method">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="random">Random</SelectItem>
                          <SelectItem value="first">
                            First Participants
                          </SelectItem>
                          <SelectItem value="last">
                            Last Participants
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleSelectWinners}>Select</Button>
                  </CardContent>
                </Card>
                <CampaignAnalytics
                  campaign={campaign}
                  participants={participants}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle>Campaign Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-3 text-muted-foreground" />{' '}
                <span>{participants.length} participants</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-3 text-muted-foreground" />{' '}
                <span>Ends on {format(campaign.endDate, 'PPP')}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-3 text-muted-foreground" />
                  <Badge
                    variant={
                      campaign.status === 'Open' ? 'default' : 'secondary'
                    }
                  >
                    {campaign.status}
                  </Badge>
                </div>
                {isHostView && campaign.status === 'Draft' && (
                  <Button
                    size="sm"
                    onClick={handleActivateCampaign}
                    disabled={isActivating}
                    className="ml-2"
                  >
                    {isActivating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Activate Campaign
                  </Button>
                )}
              </div>
              <div className="flex items-start font-semibold">
                <Gift className="h-4 w-4 mr-3 text-primary shrink-0 mt-1" />
                <div>
                  <span>Reward: {campaign.reward.name}</span>
                  <p className="text-xs font-normal text-muted-foreground break-all">
                    ({campaign.reward.type}:{' '}
                    {truncateAddress(campaign.reward.tokenAddress)})
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {role === 'participant' && (
            <Card className="bg-card border sticky top-24">
              <CardHeader>
                <CardTitle>Your Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isJoined && (
                  <Alert
                    variant="default"
                    className="border-green-500 bg-green-500/10"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertTitle className="text-green-600">
                      You've Joined!
                    </AlertTitle>
                    <AlertDescription>
                      Complete the tasks to be eligible for rewards.
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  className="w-full"
                  onClick={handleClaimRewards}
                  disabled={!canClaim || isClaiming}
                  variant="default"
                >
                  {isClaiming && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Claim Rewards
                </Button>
                {campaign.status === 'Ended' &&
                  !allTasksCompleted &&
                  isJoined && (
                    <p className="text-xs text-center text-muted-foreground">
                      Complete all tasks to claim rewards.
                    </p>
                  )}
                {address && isConnected && (
                  <p className="text-xs text-center text-muted-foreground pt-2 break-all">
                    Connected as: {address}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {role === 'host' && !isHostView && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Host View</AlertTitle>
              <AlertDescription>
                You are a host, but not the host of this specific campaign.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
      <Dialog open={isWinnerDialogOpen} onOpenChange={setIsWinnerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selected Winners</DialogTitle>
            <DialogDescription>
              Here are the {selectedWinners.length} winner(s) selected based on
              your criteria. You can now airdrop the rewards to these addresses.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2 p-2 bg-secondary/50 rounded-md">
            {selectedWinners.map((winner, index) => (
              <div
                key={winner}
                className="font-mono text-sm p-2 bg-background rounded-sm"
              >
                {index + 1}. {winner}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Use the new TaskVerificationForm component */}
      <TaskVerificationForm
        isOpen={isVerifyDialogOpen}
        onOpenChange={setIsVerifyDialogOpen}
        taskId={verifyingTaskId}
        taskType="JOIN_DISCORD"
        campaignId={campaignId}
        onVerify={handleCompleteTask}
      />
    </div>
  )
}
