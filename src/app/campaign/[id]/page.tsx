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
  getCampaignParticipantAddresses,
  openCampaign,
  completeTask,
  getUserTaskCompletionStatus,
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
  RefreshCw,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { CampaignAnalytics } from '@/components/campaign-analytics'
import { DiscordAuthButton } from '@/components/discord-auth-button'
import { TaskVerificationForm } from '@/components/task-verification-form'
import { HumanityBadge } from '@/components/humanity-badge'
import { HumanityVerificationModal } from '@/components/humanity-verification-modal'
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
    case 'JOIN_TELEGRAM':
      return <Bot className="h-5 w-5 text-blue-500" />
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
  const [participantAddresses, setParticipantAddresses] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isActivating, setIsActivating] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  // Humanity Protocol Verification State
  const [isHumanityModalOpen, setIsHumanityModalOpen] = useState(false)
  const [isCheckingHumanity, setIsCheckingHumanity] = useState(false)
  const [userHumanityStatus, setUserHumanityStatus] = useState<boolean | null>(null)

  const campaignId = id as string

  const fetchAllCampaignData = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!campaignId) return

      setIsLoading(true)
      console.log('=== FETCHING CAMPAIGN DATA ===')
      console.log('Campaign ID:', campaignId)
      console.log('Force refresh:', forceRefresh)
      console.log('User address:', address)
      console.log('Is connected:', isConnected)
      console.log('User role:', role)
      console.log('Timestamp:', new Date().toISOString())

      const fetchedCampaign = await getCampaignByIdWithMetadata(
        campaignId,
        forceRefresh
      )
      console.log('=== CAMPAIGN DATA RECEIVED ===')
      console.log('Campaign status:', fetchedCampaign?.status)
      console.log('Campaign title:', fetchedCampaign?.title)
      console.log('Campaign host:', fetchedCampaign?.host)
      console.log('Campaign participants:', fetchedCampaign?.participants)
      console.log('Start date:', fetchedCampaign?.startDate)
      console.log('End date:', fetchedCampaign?.endDate)

      if (fetchedCampaign) {
        setCampaign(fetchedCampaign)
        console.log('Campaign state updated in React')

        // Initialize tasks with default completion status
        let initialUserTasks = fetchedCampaign.tasks.map((task) => ({
          taskId: task.id,
          completed: false,
        }))

        if (address && isConnected) {
          console.log('Checking task completion status for user...')
          // Check actual task completion status for the connected wallet
          const taskCompletionStatus = await getUserTaskCompletionStatus(
            campaignId,
            address,
            fetchedCampaign.tasks
          )

          // Update task completion status based on blockchain data
          initialUserTasks = fetchedCampaign.tasks.map((task) => ({
            taskId: task.id,
            completed: taskCompletionStatus[task.id] || false,
          }))

          const hasJoined = await hasParticipated(campaignId, address)
          setIsJoined(hasJoined)
          console.log('User has joined campaign:', hasJoined)
        }

        setUserTasks(initialUserTasks)
        console.log('User tasks updated:', initialUserTasks)

        // Fetch analytics data if the current user is the host
        if (
          role === 'host' &&
          address?.toLowerCase() === fetchedCampaign.host.toLowerCase()
        ) {
          console.log('Fetching analytics data for host...')
          const data = await getCampaignParticipants(fetchedCampaign)
          setParticipants(data)

          // Also fetch basic participant addresses for immediate display
          console.log(
            'Fetching participant addresses for campaign:',
            campaignId
          )
          const addresses = await getCampaignParticipantAddresses(campaignId)
          console.log('Received participant addresses:', addresses)
          setParticipantAddresses(addresses)
        }
      } else {
        console.error('Failed to fetch campaign data')
        toast({
          variant: 'destructive',
          title: 'Campaign Not Found',
          description: 'Could not load data for this campaign.',
        })
      }
      setIsLoading(false)
      console.log('=== CAMPAIGN DATA FETCH COMPLETE ===')
    },
    [campaignId, address, isConnected, role, toast]
  )

  useEffect(() => {
    fetchAllCampaignData()
  }, [fetchAllCampaignData])

  // Additional effect to refresh task completion status when wallet connection changes
  useEffect(() => {
    if (campaignId && address && isConnected && campaign) {
      const refreshTaskCompletionStatus = async () => {
        console.log(
          'Refreshing task completion status after wallet connection change'
        )
        try {
          const taskCompletionStatus = await getUserTaskCompletionStatus(
            campaignId,
            address,
            campaign.tasks
          )

          // Update task completion status based on blockchain data
          const updatedUserTasks = campaign.tasks.map((task) => ({
            taskId: task.id,
            completed: taskCompletionStatus[task.id] || false,
          }))

          setUserTasks(updatedUserTasks)
          console.log('Updated task completion status:', updatedUserTasks)
        } catch (error) {
          console.error('Failed to refresh task completion status:', error)
        }
      }

      // Small delay to ensure wallet is fully connected
      const timeoutId = setTimeout(refreshTaskCompletionStatus, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [address, isConnected, campaign, campaignId])

  // Load any previously stored Discord and Telegram verifications on component mount
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      campaign?.id &&
      campaign.tasks?.length > 0
    ) {
      // Check local storage for previous Discord and Telegram verifications
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
              console.error('Error parsing stored Discord verification:', e)
            }
          }
        } else if (task.type === 'JOIN_TELEGRAM') {
          const storedVerification = localStorage.getItem(
            `telegram_verification_${campaign.id}_${task.id}`
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
              console.error('Error parsing stored Telegram verification:', e)
            }
          }
        }
      })
    }
  }, [campaign?.id, campaign?.tasks])

  // Check Humanity verification status when wallet connects
  useEffect(() => {
    if (address && isConnected) {
      checkHumanityStatus()
    }
  }, [address, isConnected])

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
    discordData?: any,
    telegramData?: any
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

      // For Telegram tasks, check if we have stored verification data if no telegramData is provided
      if (taskType === 'JOIN_TELEGRAM' && !telegramData) {
        const storedVerification = localStorage.getItem(
          `telegram_verification_${campaignId}_${taskId}`
        )
        if (storedVerification) {
          try {
            telegramData = JSON.parse(storedVerification)
            console.log(
              'Using stored Telegram verification data:',
              telegramData
            )
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
          telegramUsername: telegramData?.username || null,
          telegramUserId: telegramData?.userId || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success || !result.verified) {
        // Check if it's a Humanity verification error
        if (result.requiresHumanityVerification) {
          setIsHumanityModalOpen(true)
          throw new Error('Humanity Protocol verification required')
        }
        throw new Error(result.error || 'Verification failed.')
      }

      // Backend verification successful - now complete the task on blockchain
      // Find the task index from the task ID
      const taskIndex = campaign.tasks.findIndex((task) => task.id === taskId)
      if (taskIndex === -1) {
        throw new Error('Task not found in campaign')
      }

      await completeTask(campaignId, taskIndex)

      toast({
        title: 'Task Completed!',
        description: 'Great job, one step closer to your reward.',
      })

      // Refresh campaign data to update participant count and other blockchain data
      await fetchAllCampaignData()

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

      // Store successful verification in localStorage for Telegram tasks
      if (taskType === 'JOIN_TELEGRAM' && telegramData) {
        localStorage.setItem(
          `telegram_verification_${campaignId}_${taskId}`,
          JSON.stringify({
            username: telegramData.username,
            userId: telegramData.userId,
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

  // Check user's Humanity verification status
  const checkHumanityStatus = async () => {
    if (!address) return

    setIsCheckingHumanity(true)
    try {
      const response = await fetch(`/api/verify-humanity?walletAddress=${address}`)
      const data = await response.json()
      
      if (data.success) {
        setUserHumanityStatus(data.isHuman)
      }
    } catch (error) {
      console.error('Error checking Humanity status:', error)
    } finally {
      setIsCheckingHumanity(false)
    }
  }

  // Verify user with Humanity Protocol
  const handleVerifyHumanity = async () => {
    if (!address) return

    setIsCheckingHumanity(true)
    try {
      const response = await fetch('/api/verify-humanity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })

      const data = await response.json()
      
      if (data.success) {
        setUserHumanityStatus(data.isHuman)
        
        if (data.isHuman) {
          toast({
            title: 'Verification Successful!',
            description: 'You are verified as human. You can now complete this task.',
          })
          setIsHumanityModalOpen(false)
        } else {
          toast({
            variant: 'destructive',
            title: 'Not Verified',
            description: 'Please complete verification on Humanity Protocol first.',
          })
        }
      }
    } catch (error) {
      console.error('Error verifying Humanity:', error)
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: 'Could not verify Humanity status. Please try again.',
      })
    } finally {
      setIsCheckingHumanity(false)
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

      // Add a small delay to ensure blockchain state is updated
      console.log('Waiting for blockchain state to update...')
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Refresh campaign data multiple times to ensure we get the updated status
      console.log('Refreshing campaign data after activation...')
      let attempts = 0
      const maxAttempts = 5

      while (attempts < maxAttempts) {
        await fetchAllCampaignData()

        const updatedCampaign = await getCampaignByIdWithMetadata(campaign.id)
        console.log(`Refresh attempt ${attempts + 1}:`, {
          campaignStatus: updatedCampaign?.status,
          timestamp: new Date().toISOString(),
        })

        if (updatedCampaign && updatedCampaign.status === 'Open') {
          console.log('Campaign status successfully updated to Open!')
          setCampaign(updatedCampaign)
          break
        }

        attempts++
        if (attempts < maxAttempts) {
          console.log(
            `Status not yet updated, waiting and retrying... (${attempts}/${maxAttempts})`
          )
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }

      if (attempts === maxAttempts) {
        console.warn(
          'Campaign status may not have updated properly after maximum attempts'
        )
        toast({
          title: 'Status Update Delayed',
          description:
            'Campaign is activated but status may take a moment to reflect. Try refreshing manually.',
          variant: 'default',
        })
      }
    } catch (error) {
      console.error('Failed to activate campaign:', error)
    } finally {
      setIsActivating(false)
    }
  }

  const handleRefreshData = async () => {
    setIsRefreshing(true)
    try {
      console.log('Manual refresh triggered')
      await fetchAllCampaignData()

      // Force refresh campaign data from blockchain
      const freshCampaign = await getCampaignByIdWithMetadata(campaignId)
      if (freshCampaign) {
        console.log('Fresh campaign data after manual refresh:', {
          status: freshCampaign.status,
          id: freshCampaign.id,
          timestamp: new Date().toISOString(),
        })
        setCampaign(freshCampaign)
      }

      toast({
        title: 'Data Refreshed!',
        description: 'Campaign data has been updated from the blockchain.',
      })
    } catch (error) {
      console.error('Failed to refresh data:', error)
      toast({
        variant: 'destructive',
        title: 'Refresh Failed',
        description: 'Could not refresh campaign data.',
      })
    } finally {
      setIsRefreshing(false)
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

                // Debug logging for task verification status
                console.log(`Task ${task.id} verification status:`, {
                  campaignStatus: campaign.status,
                  isTaskDisabled,
                  userTaskCompleted: userTask?.completed,
                  userTaskIsCompleting: userTask?.isCompleting,
                  campaignIsOpen: campaign.status === 'Open',
                })

                return (
                  <div
                    key={task.id}
                    className="flex flex-col p-4 rounded-md bg-secondary/50 gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-background rounded-full">
                          <TaskIcon type={task.type} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={`task-${task.id}`}
                            className="text-sm font-medium leading-none"
                          >
                            {task.description}
                          </label>
                          {task.requiresHumanityVerification && (
                            <HumanityBadge size="sm" />
                          )}
                        </div>
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
                        ) : task.type === 'JOIN_TELEGRAM' ? (
                          <>
                            <Button size="sm" asChild variant="outline">
                              <Link
                                href={
                                  task.telegramInviteLink
                                    ? task.telegramInviteLink.startsWith('http')
                                      ? task.telegramInviteLink
                                      : `https://t.me/${task.telegramInviteLink}`
                                    : `https://t.me/${
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
                  participantAddresses={participantAddresses}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-card border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Campaign Info</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshData}
                  disabled={isRefreshing}
                  title="Refresh campaign status and data from blockchain"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  {isRefreshing ? '' : ' Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-3 text-muted-foreground" />{' '}
                <span>{campaign.participants} participants</span>
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
                  <>
                    <p className="text-xs text-center text-muted-foreground pt-2 break-all">
                      Connected as: {address}
                    </p>
                    {userHumanityStatus !== null && (
                      <div className="flex justify-center pt-2">
                        {userHumanityStatus ? (
                          <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Human Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Not Verified
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
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
        taskType={
          verifyingTaskId
            ? campaign.tasks.find((task) => task.id === verifyingTaskId)
                ?.type || 'JOIN_DISCORD'
            : 'JOIN_DISCORD'
        }
        campaignId={campaignId}
        onVerify={handleCompleteTask}
      />

      {/* Humanity Protocol Verification Modal */}
      <HumanityVerificationModal
        isOpen={isHumanityModalOpen}
        onOpenChange={setIsHumanityModalOpen}
        onVerify={handleVerifyHumanity}
        isVerifying={isCheckingHumanity}
      />
    </div>
  )
}
