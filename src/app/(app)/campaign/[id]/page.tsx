'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

import type {
  Campaign,
  UserTask,
  Task as TaskType,
  ParticipantData,
} from '@/lib/types'
import { useWallet } from '@/context/wallet-provider'
import { useToast } from '@/hooks/use-toast'
import {
  getCampaignByIdWithMetadata,
  hasParticipated,
  getCampaignParticipants,
  getCampaignParticipantAddresses,
  openCampaign,
  endCampaign,
  completeTask,
  getUserTaskCompletionStatus,
} from '@/lib/web3-service'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Extracted sub-components
import { CampaignHero } from './_components/campaign-hero'
import { CampaignSidebar } from './_components/campaign-sidebar'
import { TaskList } from './_components/task-list'

// Lazy-load heavy dialog components (only loaded when opened)
const TaskVerificationForm = dynamic(
  () =>
    import('@/components/task-verification-form').then(
      (mod) => ({ default: mod.TaskVerificationForm })
    ),
  { ssr: false }
)

const HumanityVerificationModal = dynamic(
  () =>
    import('@/components/humanity-verification-modal').then(
      (mod) => ({ default: mod.HumanityVerificationModal })
    ),
  { ssr: false }
)

const CampaignAnalytics = dynamic(
  () =>
    import('@/components/campaign-analytics').then(
      (mod) => ({ default: mod.CampaignAnalytics })
    ),
  { ssr: false }
)

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
  const [verifyingTaskType, setVerifyingTaskType] = useState<
    TaskType['type'] | null
  >(null)

  // Humanity Protocol Verification State
  const [isHumanityModalOpen, setIsHumanityModalOpen] = useState(false)
  const [isCheckingHumanity, setIsCheckingHumanity] = useState(false)
  const [userHumanityStatus, setUserHumanityStatus] = useState<boolean | null>(
    null,
  )

  // Payment Task State
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentTaskId, setPaymentTaskId] = useState<string | null>(null)
  const [transactionHash, setTransactionHash] = useState('')
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)

  // Campaign Action State (Launch/End) for hosts
  const [isCampaignActionDialogOpen, setIsCampaignActionDialogOpen] =
    useState(false)
  const [campaignActionToConfirm, setCampaignActionToConfirm] = useState<
    'launch' | 'end' | null
  >(null)
  const [isUpdatingCampaign, setIsUpdatingCampaign] = useState(false)

  const campaignId = id as string

  // Handler to open verification dialog
  const handleOpenVerifyDialog = (
    taskId: string,
    taskType: TaskType['type'],
  ) => {
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

  // Handler for task verification
  const handleTaskVerification = async (
    taskId: string,
    taskType: TaskType['type'],
    discordData?: any,
    telegramData?: any,
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
        task.taskId === taskId ? { ...task, isCompleting: true } : task,
      ),
    )

    try {
      // For Discord tasks, check if we have stored verification data if no discordData is provided
      if (taskType === 'JOIN_DISCORD' && !discordData) {
        const storedVerification = localStorage.getItem(
          `discord_verification_${campaignId}_${taskId}`,
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
          `telegram_verification_${campaignId}_${taskId}`,
        )
        if (storedVerification) {
          try {
            telegramData = JSON.parse(storedVerification)
            console.log(
              'Using stored Telegram verification data:',
              telegramData,
            )
          } catch (e) {
            console.error('Error parsing stored verification:', e)
          }
        }
      }

      // Handle HUMANITY_VERIFICATION task type - check verification status before proceeding
      if (taskType === 'HUMANITY_VERIFICATION') {
        const humanityResponse = await fetch(
          `/api/verify-humanity?walletAddress=${address}`,
        )
        const humanityData = await humanityResponse.json()

        if (!humanityData.success || !humanityData.isHuman) {
          // User is not verified, show modal
          setIsHumanityModalOpen(true)
          throw new Error(
            'Please complete Humanity Protocol verification first',
          )
        }
        // If verified, continue with normal flow
        if (humanityData.isHuman) {
          setUserHumanityStatus(true)
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
          taskType: taskType,
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
          }),
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
          }),
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
          task.taskId === taskId ? { ...task, isCompleting: false } : task,
        ),
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
        `/api/verify-humanity?walletAddress=${address}`,
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
        forceRefresh,
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
            fetchedCampaign.tasks,
          )

          initialUserTasks = fetchedCampaign.tasks.map((task) => ({
            taskId: task.id,
            completed: taskCompletionStatus[task.id] || false,
          }))

          const hasJoined = await hasParticipated(campaignId, address)
          setIsJoined(hasJoined)
        }

        setUserTasks(initialUserTasks)

        // Fetch participant count for all users
        const addresses = await getCampaignParticipantAddresses(campaignId)
        setParticipantAddresses(addresses)

        // Fetch detailed participant data only for hosts (used in analytics)
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
    },
    [campaignId, address, isConnected, role, toast],
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
            campaign.tasks,
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
            `discord_verification_${campaign.id}_${task.id}`,
          )
          if (storedVerification) {
            try {
              const verificationData = JSON.parse(storedVerification)
              if (verificationData.verified) {
                setUserTasks((prevTasks) =>
                  prevTasks.map((t) =>
                    t.taskId === task.id ? { ...t, completed: true } : t,
                  ),
                )
              }
            } catch (e) {
              console.error('Error parsing stored Discord verification:', e)
            }
          }
        } else if (task.type === 'JOIN_TELEGRAM') {
          const storedVerification = localStorage.getItem(
            `telegram_verification_${campaign.id}_${task.id}`,
          )
          if (storedVerification) {
            try {
              const verificationData = JSON.parse(storedVerification)
              if (verificationData.verified) {
                setUserTasks((prevTasks) =>
                  prevTasks.map((t) =>
                    t.taskId === task.id ? { ...t, completed: true } : t,
                  ),
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

  // Handle return from Humanity OAuth redirect flow
  useEffect(() => {
    const result = sessionStorage.getItem('humanity_verification_result')
    if (!result) return
    if (!address || !isConnected || !campaign) return

    try {
      const verification = JSON.parse(result)
      sessionStorage.removeItem('humanity_verification_result')

      const taskContextRaw = sessionStorage.getItem('humanity_task_context')
      sessionStorage.removeItem('humanity_task_context')
      sessionStorage.removeItem('humanity_wallet_address')

      if (verification.isHuman) {
        setUserHumanityStatus(true)

        if (taskContextRaw) {
          const taskContext = JSON.parse(taskContextRaw)
          if (taskContext.campaignId === campaignId && taskContext.taskId) {
            const taskIndex = campaign.tasks.findIndex(
              (task) => task.id === taskContext.taskId,
            )
            if (taskIndex !== -1) {
              completeTask(campaignId, taskIndex)
                .then(() => {
                  setUserTasks((prevTasks) =>
                    prevTasks.map((task) =>
                      task.taskId === taskContext.taskId
                        ? { ...task, completed: true }
                        : task,
                    ),
                  )
                  fetchAllCampaignData()
                  if (!isJoined) setIsJoined(true)
                  toast({
                    title: 'Task Completed!',
                    description:
                      'Humanity verification successful and task marked complete.',
                  })
                })
                .catch((err: any) => {
                  console.error('Error completing task after OAuth:', err)
                  toast({
                    variant: 'destructive',
                    title: 'Task Completion Failed',
                    description:
                      err.message || 'Verified but could not complete task on blockchain.',
                  })
                })
              return
            }
          }
        }

      } else {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: 'Humanity Protocol did not verify this wallet as human. Please ensure you have completed Palm verification.',
        })
      }
    } catch (e) {
      console.error('Error processing humanity verification result:', e)
    }
  }, [address, isConnected, campaign, campaignId])

  // Handle humanity verification completion (kept for direct calls)
  const handleHumanityVerificationComplete = async (isHuman: boolean) => {
    if (!isHuman) {
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: 'You are not verified as human by Humanity Protocol.',
      })
      return
    }

    setUserHumanityStatus(true)

    if (verifyingTaskId && campaign) {
      const taskIndex = campaign.tasks.findIndex(
        (task) => task.id === verifyingTaskId,
      )
      if (taskIndex !== -1) {
        try {
          await completeTask(campaignId, taskIndex)
          setUserTasks((prevTasks) =>
            prevTasks.map((task) =>
              task.taskId === verifyingTaskId
                ? { ...task, completed: true }
                : task,
            ),
          )
          await fetchAllCampaignData()
          if (!isJoined) setIsJoined(true)
          toast({
            title: 'Task Completed!',
            description:
              'Humanity verification successful and task marked complete.',
          })
        } catch (err: any) {
          console.warn('Error completing task on blockchain:', err?.message || err)
          toast({
            variant: 'destructive',
            title: 'Task Completion Failed',
            description:
              err.message || 'Verified but could not complete task on blockchain.',
          })
        }
      }
    } else {
      toast({
        title: 'Verification Successful!',
        description: 'Your wallet is verified as human.',
      })
    }

    setIsHumanityModalOpen(false)
    setVerifyingTaskId(null)
    setVerifyingTaskType(null)
  }

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

  const openCampaignActionDialog = (action: 'launch' | 'end') => {
    setCampaignActionToConfirm(action)
    setIsCampaignActionDialogOpen(true)
  }

  const handleConfirmCampaignAction = async () => {
    if (!campaignActionToConfirm || !campaign) return

    setIsUpdatingCampaign(true)
    try {
      if (campaignActionToConfirm === 'launch') {
        if (campaign.status !== 'Draft') {
          toast({
            variant: 'destructive',
            title: 'Already Launched',
            description: 'This campaign is already open.',
          })
          return
        }
        const resultCampaignId = await openCampaign(campaignId, toast)
        if (resultCampaignId !== campaignId) {
          window.location.href = `/campaign/${resultCampaignId}`
          return
        }
        toast({
          title: 'Campaign Launched!',
          description: 'Your campaign is now live and accepting participants.',
        })
      } else if (campaignActionToConfirm === 'end') {
        await endCampaign(campaignId)
        toast({
          title: 'Campaign Ended',
          description: 'Your campaign has been closed.',
        })
      }
      await fetchAllCampaignData(true)
    } catch (error) {
      // Error toast is shown in the service
    } finally {
      setIsUpdatingCampaign(false)
      setIsCampaignActionDialogOpen(false)
      setCampaignActionToConfirm(null)
    }
  }

  // Check if current user is the host of this campaign
  const isHostOfCampaign =
    role === 'host' &&
    campaign &&
    address?.toLowerCase() === campaign.host.toLowerCase()

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

  return (
    <div className="min-h-screen bg-gradient-soft">
      {/* Hero Section */}
      <CampaignHero campaign={campaign} />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <TaskList
              campaign={campaign}
              userTasks={userTasks}
              role={role}
              onOpenVerifyDialog={handleOpenVerifyDialog}
            />

            {/* Participant Analytics - Only for Host */}
            {isHostOfCampaign && (
              <CampaignAnalytics
                campaign={campaign}
                participants={participants}
                participantAddresses={participantAddresses}
                isLoading={isLoading}
              />
            )}
          </div>

          {/* Right Column - Info Sidebar */}
          <div className="space-y-6">
            <CampaignSidebar
              campaign={campaign}
              participantCount={participantAddresses.length}
              isHostOfCampaign={!!isHostOfCampaign}
              isRefreshing={isRefreshing}
              isUpdatingCampaign={isUpdatingCampaign}
              campaignActionToConfirm={campaignActionToConfirm}
              onShare={handleShare}
              onRefresh={handleRefresh}
              onCampaignAction={openCampaignActionDialog}
            />
          </div>
        </div>
      </div>

      {/* Task Verification Dialog - Lazy loaded */}
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

      {/* Humanity Verification Modal - Lazy loaded */}
      <HumanityVerificationModal
        isOpen={isHumanityModalOpen}
        onOpenChange={setIsHumanityModalOpen}
        campaignId={campaignId}
        taskId={verifyingTaskId || undefined}
        isVerified={userHumanityStatus === true}
        onVerificationComplete={handleHumanityVerificationComplete}
        preset={
          verifyingTaskId
            ? (campaign?.tasks.find((t) => t.id === verifyingTaskId)?.metadata?.humanityPreset ?? 'is_human')
            : 'is_human'
        }
      />

      {/* Campaign Action Confirmation Dialog */}
      <AlertDialog
        open={isCampaignActionDialogOpen}
        onOpenChange={setIsCampaignActionDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {campaignActionToConfirm === 'launch'
                ? 'Launch Campaign?'
                : 'End Campaign?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {campaignActionToConfirm === 'launch'
                ? 'This will make your campaign live and allow participants to join and complete tasks. This action cannot be undone.'
                : 'This will close your campaign and stop accepting new participants. Completed tasks will remain recorded. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingCampaign}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCampaignAction}
              disabled={isUpdatingCampaign}
              className={
                campaignActionToConfirm === 'end'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {isUpdatingCampaign ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {campaignActionToConfirm === 'launch' ? 'Launch' : 'End Campaign'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}