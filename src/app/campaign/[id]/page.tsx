'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { format } from 'date-fns'
import Link from 'next/link'
import { motion } from 'framer-motion'

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
  ImageIcon,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { CampaignAnalytics } from '@/components/campaign-analytics'
import { DiscordAuthButton } from '@/components/discord-auth-button'
import { TaskVerificationForm } from '@/components/task-verification-form'
import { HumanityVerificationModal } from '@/components/humanity-verification-modal'
import { CampaignImageUpload } from '@/components/campaign-image-upload'
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
      return <Twitter className="h-5 w-5 text-primary" />
    case 'JOIN_DISCORD':
      return <MessageSquare className="h-5 w-5 text-indigo-600" />
    case 'JOIN_TELEGRAM':
      return <Bot className="h-5 w-5 text-blue-600" />
    case 'RETWEET':
      return <Twitter className="h-5 w-5 text-primary" />
    case 'ONCHAIN_TX':
      return <ShieldCheck className="h-5 w-5 text-green-600" />
    case 'HUMANITY_VERIFICATION':
      return <ShieldCheck className="h-5 w-5 text-purple-600" />
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
  const [verifyingTaskType, setVerifyingTaskType] = useState<TaskType['type'] | null>(null)

  // Humanity Protocol Verification State
  const [isHumanityModalOpen, setIsHumanityModalOpen] = useState(false)
  const [isCheckingHumanity, setIsCheckingHumanity] = useState(false)
  const [userHumanityStatus, setUserHumanityStatus] = useState<boolean | null>(
    null
  )

  // Payment Task State
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentTaskId, setPaymentTaskId] = useState<string | null>(null)
  const [transactionHash, setTransactionHash] = useState('')
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)

  const campaignId = id as string

  // Handler to open verification dialog
  const handleOpenVerifyDialog = (taskId: string, taskType: TaskType['type']) => {
    console.log('Opening verify dialog for task:', taskId, taskType)
    setVerifyingTaskId(taskId)
    setVerifyingTaskType(taskType)

    // Handle different task types
    if (taskType === 'HUMANITY_VERIFICATION') {
      setIsHumanityModalOpen(true)
    } else if (taskType === 'ONCHAIN_TX') {
      setPaymentTaskId(taskId)
      setIsPaymentDialogOpen(true)
    } else {
      setIsVerifyDialogOpen(true)
    }
  }

  // Handler for task verification - Complete implementation from old file
  const handleTaskVerification = async (
    taskId: string,
    taskType: TaskType['type'],
    discordData?: any,
    telegramData?: any
  ) => {
    if (!isConnected || !address || !campaign) {
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
            console.log('Using stored Telegram verification data:', telegramData)
          } catch (e) {
            console.error('Error parsing stored verification:', e)
          }
        }
      }

      // Handle HUMANITY_VERIFICATION task type - check verification status before proceeding
      if (taskType === 'HUMANITY_VERIFICATION') {
        const humanityResponse = await fetch(
          `/api/verify-humanity?walletAddress=${address}`
        )
        const humanityData = await humanityResponse.json()

        if (!humanityData.success || !humanityData.isHuman) {
          // User is not verified, show modal
          setIsHumanityModalOpen(true)
          throw new Error('Please complete Humanity Protocol verification first')
        }
        // If verified, continue with normal flow
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

  const checkHumanityStatus = async () => {
    if (!address) return

    setIsCheckingHumanity(true)
    try {
      const response = await fetch(
        `/api/verify-humanity?walletAddress=${address}`
      )
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

  const fetchAllCampaignData = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!campaignId) return

      setIsLoading(true)
      const fetchedCampaign = await getCampaignByIdWithMetadata(
        campaignId,
        forceRefresh
      )

      if (fetchedCampaign) {
        setCampaign(fetchedCampaign)

        let initialUserTasks = fetchedCampaign.tasks.map((task) => ({
          taskId: task.id,
          completed: false,
        }))

        if (address && isConnected) {
          const taskCompletionStatus = await getUserTaskCompletionStatus(
            campaignId,
            address,
            fetchedCampaign.tasks
          )

          initialUserTasks = fetchedCampaign.tasks.map((task) => ({
            taskId: task.id,
            completed: taskCompletionStatus[task.id] || false,
          }))

          const hasJoined = await hasParticipated(campaignId, address)
          setIsJoined(hasJoined)
        }

        setUserTasks(initialUserTasks)

        if (
          role === 'host' &&
          address?.toLowerCase() === fetchedCampaign.host.toLowerCase()
        ) {
          const data = await getCampaignParticipants(fetchedCampaign)
          setParticipants(data)

          const addresses = await getCampaignParticipantAddresses(campaignId)
          setParticipantAddresses(addresses)
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Campaign Not Found',
          description: 'Could not load data for this campaign.',
        })
      }
      setIsLoading(false)
    },
    [campaignId, address, isConnected, role, toast]
  )

  useEffect(() => {
    fetchAllCampaignData()
  }, [fetchAllCampaignData])

  useEffect(() => {
    if (campaignId && address && isConnected && campaign) {
      const refreshTaskCompletionStatus = async () => {
        try {
          const taskCompletionStatus = await getUserTaskCompletionStatus(
            campaignId,
            address,
            campaign.tasks
          )

          const updatedUserTasks = campaign.tasks.map((task) => ({
            taskId: task.id,
            completed: taskCompletionStatus[task.id] || false,
          }))

          setUserTasks(updatedUserTasks)
        } catch (error) {
          console.error('Failed to refresh task completion status:', error)
        }
      }

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
      campaign.tasks.forEach((task) => {
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

  // [KEEPING ALL OTHER EXISTING useEffects AND HANDLER FUNCTIONS]
  // ... (All the existing logic will remain)

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: campaign?.title,
        text: campaign?.longDescription,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast({
        title: 'Link Copied!',
        description: 'Campaign link copied to clipboard.',
      })
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAllCampaignData(true)
    setIsRefreshing(false)
    toast({
      title: 'Refreshed!',
      description: 'Campaign data has been updated.',
    })
  }

  // Verify user with Humanity Protocol
  const handleVerifyHumanity = async (walletAddress?: string) => {
    console.log('🚀 handleVerifyHumanity called with:', walletAddress)
    const addressToVerify = walletAddress || address
    if (!addressToVerify) {
      console.log('❌ No wallet address provided')
      toast({
        variant: 'destructive',
        title: 'No Wallet Address',
        description: 'Please provide a wallet address to verify.',
      })
      return
    }

    console.log('🔍 Verifying humanity for address:', addressToVerify)
    setIsCheckingHumanity(true)
    try {
      const response = await fetch('/api/verify-humanity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: addressToVerify }),
      })

      console.log(
        '📡 API response status:',
        response.status,
        response.statusText
      )
      const data = await response.json()
      console.log('📄 Raw API Response:', JSON.stringify(data, null, 2))

      if (data.success) {
        console.log(
          '✅ API success=true, isHuman value:',
          data.isHuman,
          typeof data.isHuman
        )
        setUserHumanityStatus(data.isHuman)

        if (data.isHuman) {
          console.log('🎉 SHOWING SUCCESS TOAST - data.isHuman is truthy')
          toast({
            title: 'Verification Successful!',
            description: `Address ${addressToVerify.slice(
              0,
              6
            )}...${addressToVerify.slice(
              -4
            )} is verified as human. You can now complete this task.`,
          })
          setIsHumanityModalOpen(false)
        } else {
          toast({
            variant: 'destructive',
            title: 'Not Verified',
            description: `Address ${addressToVerify.slice(
              0,
              6
            )}...${addressToVerify.slice(
              -4
            )} is not verified. Please complete verification on Humanity Protocol first.`,
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


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Campaign Not Found</CardTitle>
            <CardDescription>
              This campaign doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/">Return Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const completedTasksCount = userTasks.filter((ut) => ut.completed).length
  const progressPercentage = (completedTasksCount / campaign.tasks.length) * 100
  const allTasksCompleted = completedTasksCount === campaign.tasks.length

  // Debug logging
  console.log('Campaign data:', {
    id: campaign.id,
    title: campaign.title,
    imageUrl: campaign.imageUrl,
    hasImageUrl: !!campaign.imageUrl,
  })

  return (
    <div className="min-h-screen bg-gradient-soft">
      {/* Hero Section */}
      <motion.div
        className="relative h-[400px] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {campaign.imageUrl && !campaign.imageUrl.includes('placehold.co') && (
          <Image
            src={campaign.imageUrl}
            alt={campaign.title}
            fill
            className="object-cover"
            priority
            unoptimized={campaign.imageUrl.startsWith('http')}
            onError={(e) => {
              console.error('❌ Image failed to load:', campaign.imageUrl);
              console.error('Error details:', e);
            }}
            onLoad={() => {
              console.log('✅ Image loaded successfully:', campaign.imageUrl);
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />

        {/* Back Button */}
        <div className="absolute top-6 left-6">
          <Button
            variant="secondary"
            size="sm"
            asChild
            className="backdrop-blur-sm bg-white/90 hover:bg-white"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        {/* Campaign Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="container mx-auto">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <Badge className="mb-4 bg-white/20 backdrop-blur-sm text-white border-white/30">
                {campaign.status}
              </Badge>
              <h1 className="text-4xl md:text-5xl font-headline font-bold text-white mb-3">
                {campaign.title}
              </h1>
              <p className="text-lg text-white/90 max-w-3xl">
                {campaign.longDescription}
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Tasks */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Card */}
            {role === 'participant' && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                <Card className="card-modern">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-headline font-semibold text-lg">Your Progress</h3>
                        <p className="text-sm text-muted-foreground">
                          {completedTasksCount} of {campaign.tasks.length} tasks completed
                        </p>
                      </div>
                      <div className="text-3xl font-bold text-primary">
                        {Math.round(progressPercentage)}%
                      </div>
                    </div>
                    <Progress value={progressPercentage} className="h-3" />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Tasks List */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <Card className="card-modern">
                <CardHeader>
                  <CardTitle className="font-headline">Tasks to Complete</CardTitle>
                  <CardDescription>
                    Complete all tasks to be eligible for rewards
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {campaign.tasks.map((task, index) => {
                    const userTask = userTasks.find((ut) => ut.taskId === task.id)
                    const isCompleted = userTask?.completed

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                        className={`p-4 rounded-xl border-2 transition-all ${isCompleted
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-slate-200 hover:border-primary hover:shadow-card'
                          }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${isCompleted ? 'bg-green-100' : 'bg-slate-100'}`}>
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <TaskIcon type={task.type} />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">{task.description}</h4>
                            {task.type === 'ONCHAIN_TX' && task.metadata?.paymentRequired && (
                              <Badge variant="outline" className="text-xs">
                                💰 {task.metadata.amountDisplay} on {task.metadata.network}
                              </Badge>
                            )}
                          </div>
                          {role === 'participant' && !isCompleted && campaign.status === 'Open' && (
                            <Button
                              size="sm"
                              className="shimmer"
                              onClick={() => handleOpenVerifyDialog(task.id, task.type)}
                            >
                              Verify
                            </Button>
                          )}
                          {isCompleted && (
                            <Badge className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Done
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Info Sidebar */}
          <div className="space-y-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <Card className="card-modern sticky top-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-headline">Campaign Info</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Participants */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Participants</p>
                      <p className="text-2xl font-bold">{participantAddresses.length}</p>
                    </div>
                  </div>

                  {/* End Date */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Ends On</p>
                      <p className="font-semibold">
                        {format(new Date(campaign.endDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>

                  {/* Reward */}
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                    <Gift className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Reward</p>
                      <p className="font-semibold">{campaign.reward.name}</p>
                    </div>
                  </div>

                  {/* Share Button */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Campaign
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Task Verification Dialog */}
      {verifyingTaskType && (
        <TaskVerificationForm
          isOpen={isVerifyDialogOpen}
          onOpenChange={setIsVerifyDialogOpen}
          taskId={verifyingTaskId}
          taskType={verifyingTaskType}
          campaignId={campaignId}
          onVerify={handleTaskVerification}
        />
      )}

      {/* Humanity Verification Modal */}
      <HumanityVerificationModal
        isOpen={isHumanityModalOpen}
        onOpenChange={setIsHumanityModalOpen}
        onVerify={handleVerifyHumanity}
        isVerifying={isCheckingHumanity}
      />
    </div>
  )
}
