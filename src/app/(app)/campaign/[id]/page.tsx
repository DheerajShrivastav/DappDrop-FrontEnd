'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
  submitAttestationFromWallet,
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
import { Loader2, SearchX } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
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
import { CampaignLifecycleBanner } from './_components/campaign-lifecycle-banner'
import { MerkleSettlementPanel } from './_components/merkle-settlement-panel'
import { ClaimPanel } from './_components/claim-panel'
import { TieredClaimPanel } from './_components/tiered-claim-panel'
import { TieredLeaderboard } from './_components/tiered-leaderboard'
import { NFTClaimPanel } from './_components/nft-claim-panel'
import { NFTSettlementPanel } from './_components/nft-settlement-panel'
import { PublicAllocationView } from './_components/public-allocation-view'
import { DisputeReportsPanel } from './_components/dispute-reports-panel'

// Lazy-load heavy dialog components (only loaded when opened)
const TaskVerificationForm = dynamic(
  () =>
    import('@/components/task-verification-form').then((mod) => ({
      default: mod.TaskVerificationForm,
    })),
  { ssr: false },
)

const HumanityVerificationModal = dynamic(
  () =>
    import('@/components/humanity-verification-modal').then((mod) => ({
      default: mod.HumanityVerificationModal,
    })),
  { ssr: false },
)

const CampaignAnalytics = dynamic(
  () =>
    import('@/components/campaign-analytics').then((mod) => ({
      default: mod.CampaignAnalytics,
    })),
  { ssr: false },
)

const CampaignFunnelAnalytics = dynamic(
  () =>
    import('@/components/campaign-funnel-analytics').then((mod) => ({
      default: mod.CampaignFunnelAnalytics,
    })),
  { ssr: false },
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
  const fetchInFlightRef = useRef<Promise<void> | null>(null)
  const lastFetchRef = useRef(0)

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
    if (isTimeExpiredNotClosed) {
      toast({
        variant: 'destructive',
        title: 'Campaign Expired',
        description:
          'This campaign\'s end time has passed but it has not been officially closed by the creator. No new interactions are possible.',
      })
      return
    }

    console.log('Opening verify dialog for task:', taskId, taskType)
    setVerifyingTaskId(taskId)
    setVerifyingTaskType(taskType)

    // Handle different task types
    if (taskType === 'HUMANITY_VERIFICATION') {
      setIsHumanityModalOpen(true)
    } else if (taskType === 'ONCHAIN_TX') {
      setPaymentTaskId(taskId)
      setIsPaymentDialogOpen(true)
    } else if (
      taskType === 'ONCHAIN_HOLD_ERC20' ||
      taskType === 'ONCHAIN_HOLD_ERC721'
    ) {
      // Self-verified on-chain in completeTask (FR-T2) — the contract checks the balance
      // in-transaction, so this NEVER goes through the backend verifier/signer (which
      // explicitly rejects these two types). No dialog: it's a direct wallet transaction.
      handleHoldTaskCompletion(taskId)
    } else {
      setIsVerifyDialogOpen(true)
    }
  }

  // FR-T2: ONCHAIN_HOLD_ERC20/ERC721 are the only task types that always cost the
  // participant gas. TODO(P1): pre-check the on-chain balance and warn *before* the user
  // pays gas for a doomed tx (the wizard/task metadata carries the token+threshold needed
  // to do this) — for now this goes straight to the wallet transaction.
  const handleHoldTaskCompletion = async (taskId: string) => {
    if (!isConnected || !address || !campaign) {
      toast({
        variant: 'destructive',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet.',
      })
      return
    }

    const taskIndex = campaign.tasks.findIndex((task) => task.id === taskId)
    if (taskIndex === -1) return

    const alreadyDone = userTasks.find((ut) => ut.taskId === taskId)?.completed
    if (alreadyDone) {
      toast({
        title: 'Task Already Completed',
        description: 'This task was already completed.',
      })
      return
    }

    setUserTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.taskId === taskId ? { ...task, isCompleting: true } : task,
      ),
    )

    try {
      await completeTask(campaignId, taskIndex)
      setUserTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.taskId === taskId ? { ...task, completed: true } : task,
        ),
      )
      await fetchAllCampaignData()
      if (!isJoined) setIsJoined(true)
      toast({
        title: 'Task Completed!',
        description: 'Great job, one step closer to your reward.',
      })
    } catch (error: any) {
      const message = String(error?.message ?? error ?? '')
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message || 'Failed to complete task.',
      })
    } finally {
      setUserTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.taskId === taskId ? { ...task, isCompleting: false } : task,
        ),
      )
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
      return false
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
        throw new Error(result.message || result.error || 'Verification failed.')
      }

      // v0.6.0: attested tasks are recorded via an EIP-712 signature, NOT the old
      // client completeTask (which now reverts TaskManagedBySignature). The backend signs
      // and, by default, submits. If it couldn't submit, self-submit the returned signature
      // from the connected wallet (BR-V3 fallback).
      if (result.attested) {
        if (result.submitted) {
          // Backend already recorded completion on-chain — nothing more to do.
        } else if (result.attestation?.signature) {
          await submitAttestationFromWallet(
            campaignId,
            result.attestation.participant,
            result.attestation.taskIndex,
            result.attestation.completed,
            result.attestation.deadline,
            result.attestation.signature,
          )
        } else {
          throw new Error(
            'Verified, but completion could not be recorded on-chain. Please try again.',
          )
        }
      }

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

      return true
    } catch (error: any) {
      const message = String(error?.message ?? error ?? '')
      let description = message || 'Failed to complete task.'
      if (message.includes('not in active period')) {
        description = 'This campaign is not currently active.'
      } else if (message.includes('Campaign participant limit reached')) {
        description =
          'The maximum participant limit for this campaign has been reached.'
      }
      toast({ variant: 'destructive', title: 'Error', description })
      return false
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

  const fetchAllCampaignData = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!campaignId) return
      const now = Date.now()
      if (!forceRefresh && now - lastFetchRef.current < 800) return
      if (fetchInFlightRef.current) return fetchInFlightRef.current

      const fetchPromise = (async () => {
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

          const isHostForCampaign =
            role === 'host' &&
            address?.toLowerCase() === fetchedCampaign.host.toLowerCase()

          if (isHostForCampaign && fetchedCampaign.participants > 0) {
            const addresses = await getCampaignParticipantAddresses(campaignId)
            setParticipantAddresses(addresses)
            const data = await getCampaignParticipants(fetchedCampaign)
            setParticipants(data)
          } else {
            setParticipantAddresses([])
            setParticipants([])
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Campaign Not Found',
            description: 'Could not load data for this campaign.',
          })
        }
        setIsLoading(false)
      })()

      fetchInFlightRef.current = fetchPromise
      try {
        await fetchPromise
      } finally {
        fetchInFlightRef.current = null
        lastFetchRef.current = Date.now()
      }
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

  // NOTE: We intentionally do NOT check the global humanity verification status
  // on page load. The `userHumanityStatus` state is per-campaign — it should only
  // be set to true after the user completes the Humanity OAuth flow FOR THIS campaign.
  // The task completion status from the blockchain (in userTasks) is the source of
  // truth for whether a humanity task has been completed.

  // Handle return from Humanity OAuth redirect flow
  useEffect(() => {
    const result = sessionStorage.getItem('humanity_verification_result')
    if (!result) return
    if (!address || !isConnected || !campaign) return

    try {
      const verification = JSON.parse(result)
      sessionStorage.removeItem('humanity_verification_result')

      const taskContextRaw = sessionStorage.getItem('humanity_task_context')
      // Read the stored wallet BEFORE removing it so we can compare
      const storedWallet = sessionStorage.getItem('humanity_wallet_address')
      sessionStorage.removeItem('humanity_task_context')
      sessionStorage.removeItem('humanity_wallet_address')

      // Security: ensure the wallet that initiated verification matches
      // the currently connected wallet. Prevents cross-wallet exploitation.
      if (
        storedWallet &&
        storedWallet.toLowerCase() !== address.toLowerCase()
      ) {
        console.warn('Humanity verification wallet mismatch:', {
          stored: storedWallet,
          current: address,
        })
        toast({
          variant: 'destructive',
          title: 'Wallet Mismatch',
          description:
            'The wallet used for verification does not match your currently connected wallet. Please reconnect the correct wallet and try again.',
        })
        return
      }

      if (verification.isHuman) {
        if (taskContextRaw) {
          const taskContext = JSON.parse(taskContextRaw)
          if (taskContext.campaignId === campaignId && taskContext.taskId) {
            const taskIndex = campaign.tasks.findIndex(
              (task) => task.id === taskContext.taskId,
            )
            if (taskIndex !== -1) {
              // Check if this task is already completed on-chain (e.g. from a prior attempt)
              const alreadyDone = userTasks.find(
                (ut) => ut.taskId === taskContext.taskId,
              )?.completed

              if (alreadyDone) {
                // Task already completed — just update UI state
                setUserHumanityStatus(true)
                toast({
                  title: 'Task Already Completed',
                  description:
                    'This humanity verification task was already completed.',
                })
                return
              }

              // v0.6.0: HUMANITY_VERIFICATION is an attested task (completeTask now reverts
              // TaskManagedBySignature for it). Route through the shared verify+attest flow —
              // it POSTs /api/verify-task, signs/submits (or self-submits) the EIP-712
              // attestation, updates userTasks, refreshes campaign data, and shows its own
              // success/failure toast. handleTaskVerification never throws (it reports
              // failure via its own toast + a `false` return), so we branch on the return
              // value rather than try/catch.
              ;(async () => {
                const success = await handleTaskVerification(
                  taskContext.taskId,
                  'HUMANITY_VERIFICATION',
                )
                if (success) {
                  setUserHumanityStatus(true)
                  if (!isJoined) setIsJoined(true)
                  return
                }

                // Failure path: re-check on-chain state directly — a prior attempt (or a
                // backend-submitted attestation whose response we failed to process) may
                // have actually completed the task despite the reported failure.
                let taskAlreadyDone = false
                try {
                  const status = await getUserTaskCompletionStatus(
                    campaignId,
                    address,
                    campaign.tasks,
                  )
                  taskAlreadyDone = status[taskContext.taskId] === true
                } catch {
                  /* ignore re-check errors */
                }

                if (taskAlreadyDone) {
                  setUserHumanityStatus(true)
                  setUserTasks((prevTasks) =>
                    prevTasks.map((task) =>
                      task.taskId === taskContext.taskId
                        ? { ...task, completed: true }
                        : task,
                    ),
                  )
                  toast({
                    title: 'Task Already Completed',
                    description:
                      'This task was already completed on the blockchain.',
                  })
                } else {
                  // handleTaskVerification already showed a specific destructive toast —
                  // just reset local state so the user can retry.
                  setUserHumanityStatus(null)
                }
              })()
              return
            }
          }
        }

        // No task context — just mark identity as verified
        setUserHumanityStatus(true)
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description:
            'Humanity Protocol did not verify this wallet as human. Please ensure you have completed Palm verification.',
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

    if (verifyingTaskId && campaign) {
      const taskIndex = campaign.tasks.findIndex(
        (task) => task.id === verifyingTaskId,
      )
      if (taskIndex !== -1) {
        // Check if this task is already completed on-chain
        const alreadyDone = userTasks.find(
          (ut) => ut.taskId === verifyingTaskId,
        )?.completed

        if (alreadyDone) {
          setUserHumanityStatus(true)
          toast({
            title: 'Task Already Completed',
            description:
              'This humanity verification task was already completed.',
          })
        } else {
          // v0.6.0: HUMANITY_VERIFICATION is attested, not self-verified — completeTask now
          // reverts TaskManagedBySignature for it. Route through the shared verify+attest
          // flow (never throws; reports failure via its own toast + a `false` return).
          const success = await handleTaskVerification(
            verifyingTaskId,
            'HUMANITY_VERIFICATION',
          )

          if (success) {
            setUserHumanityStatus(true)
            if (!isJoined) setIsJoined(true)
          } else {
            // Re-check on-chain state directly before giving up — a prior attempt (or a
            // backend-submitted attestation we failed to process) may have landed anyway.
            let taskAlreadyDone = false
            try {
              const status = await getUserTaskCompletionStatus(
                campaignId,
                address!,
                campaign.tasks,
              )
              taskAlreadyDone = status[verifyingTaskId] === true
            } catch {
              /* ignore re-check errors */
            }

            if (taskAlreadyDone) {
              setUserHumanityStatus(true)
              setUserTasks((prevTasks) =>
                prevTasks.map((task) =>
                  task.taskId === verifyingTaskId
                    ? { ...task, completed: true }
                    : task,
                ),
              )
              toast({
                title: 'Task Already Completed',
                description:
                  'This task was already completed on the blockchain.',
              })
            } else {
              // handleTaskVerification already showed a specific destructive toast.
              setUserHumanityStatus(null)
            }
          }
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

  // Campaign is open on-chain but its end time has already passed —
  // the creator forgot to call endCampaign(). Users cannot interact.
  const isTimeExpiredNotClosed =
    campaign?.status === 'Open' && new Date() > new Date(campaign.endDate)

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-[400px] w-full rounded-none" />
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md shadow-elevated">
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
              <SearchX className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle>Campaign not found</CardTitle>
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
      <CampaignHero campaign={campaign} isTimeExpiredNotClosed={!!isTimeExpiredNotClosed} />

      {/* Lifecycle state ladder (NFR-9): honest, named state with claim/sweep timing. */}
      <div className="container mx-auto px-4 pt-8 space-y-6">
        <CampaignLifecycleBanner campaign={campaign} />
        {/* Public, unauthenticated once a root is published (P4 Part 1, BR-M4) — the banner's
            "View all allocations" link anchors here. */}
        <PublicAllocationView campaign={campaign} />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <TaskList
              campaign={campaign}
              userTasks={userTasks}
              role={role}
              isTimeExpiredNotClosed={!!isTimeExpiredNotClosed}
              onOpenVerifyDialog={handleOpenVerifyDialog}
            />

            {/* Self-claim (FR-C1/C2) — any connected wallet with an allocation (Merkle-only;
                each panel early-returns null when campaign.settlement.mode doesn't match) */}
            <ClaimPanel campaign={campaign} />
            <TieredClaimPanel campaign={campaign} />
            <TieredLeaderboard campaign={campaign} />
            <NFTClaimPanel campaign={campaign} />

            {/* Host-only: review & publish the allocation (FR-M3). Each panel is guarded to its
                own settlement mode — never shown for a tiered or cross-mode campaign. */}
            {isHostOfCampaign && <MerkleSettlementPanel campaign={campaign} />}
            {isHostOfCampaign && <NFTSettlementPanel campaign={campaign} />}

            {/* Host resolution flow for reported concerns + the close-campaign guard (P4 Part 4) */}
            {isHostOfCampaign && <DisputeReportsPanel campaign={campaign} />}

            {/* Host-only: funnel/completion/claim-rate analytics + CSV export (P3 CP3) */}
            {isHostOfCampaign && <CampaignFunnelAnalytics campaign={campaign} />}

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
              participantCount={campaign.participants}
              isHostOfCampaign={!!isHostOfCampaign}
              isRefreshing={isRefreshing}
              isUpdatingCampaign={isUpdatingCampaign}
              isTimeExpiredNotClosed={!!isTimeExpiredNotClosed}
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
          onVerify={async (taskId, taskType, discordData, telegramData) => {
            // handleTaskVerification returns a success boolean for the humanity call sites
            // that need to branch on it; this dialog only needs the side effects, so adapt
            // to the Promise<void> shape the form expects.
            await handleTaskVerification(taskId, taskType, discordData, telegramData)
          }}
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
            ? (campaign?.tasks.find((t) => t.id === verifyingTaskId)?.metadata
                ?.humanityPreset ?? 'is_human')
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
