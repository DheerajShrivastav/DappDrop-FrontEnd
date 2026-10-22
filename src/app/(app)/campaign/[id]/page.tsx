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
  endCampaign,
  completeTask,
  submitAttestationFromWallet,
  getUserTaskCompletionStatus,
} from '@/lib/web3-service'

import { Button } from '@/components/app/button'
import { EmptyState, LoadingRegion, Skeleton, ClaimSkeleton, RowsSkeleton } from '@/components/app/states'
import { PageContainer } from '@/components/app/page-header'
import { useDocumentTitle } from '@/components/app/document-title'
import { CampaignView } from './_components/campaign-view'
import { getCampaignStatus } from '@/lib/campaign-status'
import { DEPLOYMENT_CHAIN } from '@/lib/deployment-chain'
import { paymentRequestFromTask } from '@/lib/payment-request'
import type { PaymentVerifyResult } from '@/lib/payment-task-client'

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

const PaymentTaskDialog = dynamic(
  () =>
    import('./_components/payment-task-dialog').then((mod) => ({
      default: mod.PaymentTaskDialog,
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
  const { isConnected, role, address, connectWallet } = useWallet()
  const { toast } = useToast()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [userTasks, setUserTasks] = useState<UserTask[]>([])
  const [isJoined, setIsJoined] = useState(false)
  const [participants, setParticipants] = useState<ParticipantData[]>([])
  const [participantAddresses, setParticipantAddresses] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  // The last verification failure per task, in words: the row shows "! Couldn't verify: …".
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({})
  const [isRecordingEnd, setIsRecordingEnd] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const fetchInFlightRef = useRef<Promise<void> | null>(null)
  const lastFetchRef = useRef(0)

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

  const campaignId = id as string

  // Handler to open verification dialog
  const handleOpenVerifyDialog = (
    taskId: string,
    taskType: TaskType['type'],
  ) => {
    if (isTimeExpiredNotClosed) {
      toast({
        variant: 'destructive',
        title: 'This campaign has ended',
        description:
          'Its end time has passed, so tasks can no longer be completed.',
      })
      return
    }

    setTaskErrors(({ [taskId]: _, ...rest }) => rest)
    setVerifyingTaskId(taskId)
    setVerifyingTaskType(taskType)

    // Handle different task types
    if (taskType === 'HUMANITY_VERIFICATION') {
      setIsHumanityModalOpen(true)
    } else if (taskType === 'ONCHAIN_TX') {
      if (!isConnected || !address) {
        toast({ variant: 'destructive', title: 'Wallet Not Connected', description: 'Please connect your wallet.' })
        return
      }
      const task = campaign?.tasks.find((t) => t.id === taskId)
      if (!task || !paymentRequestFromTask(task, DEPLOYMENT_CHAIN.id)) {
        const description = 'this payment task’s settings are missing or incomplete. Ask the host to check it.'
        setTaskErrors((prev) => ({ ...prev, [taskId]: description }))
        return
      }
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
        title: 'Task done',
        description: 'One step closer to your reward.',
      })
    } catch (error: any) {
      const message = String(error?.message ?? error ?? '')
      setTaskErrors((prev) => ({ ...prev, [taskId]: message || 'the transaction didn’t go through.' }))
      toast({
        variant: 'destructive',
        title: 'The task wasn’t completed',
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

  // v0.6.0: attested tasks are recorded via an EIP-712 signature, NOT the old
  // client completeTask (which now reverts TaskManagedBySignature). The backend signs
  // and, by default, submits. If it couldn't submit, self-submit the returned signature
  // from the connected wallet (BR-V3 fallback). Shared by /api/verify-task and the payment
  // dialog (/api/tasks/verify-payment), which return the same attestation shape.
  const recordAttestation = async (result: {
    attested?: boolean
    submitted?: boolean
    attestation?: PaymentVerifyResult['attestation']
  }) => {
    if (!result.attested || result.submitted) return
    if (!result.attestation?.signature) {
      throw new Error('Verified, but completion could not be recorded on-chain. Please try again.')
    }
    await submitAttestationFromWallet(
      campaignId,
      result.attestation.participant,
      result.attestation.taskIndex,
      result.attestation.completed,
      result.attestation.deadline,
      result.attestation.signature,
    )
  }

  // The payment dialog's last step: the server checked the payment and signed the completion.
  // Throws back into the dialog (which keeps the payment's hash for a re-check) on failure.
  const handlePaymentVerified = async (taskId: string, result: PaymentVerifyResult) => {
    await recordAttestation(result)
    setTaskErrors(({ [taskId]: _, ...rest }) => rest)
    setUserTasks((prev) => prev.map((t) => (t.taskId === taskId ? { ...t, completed: true } : t)))
    toast({ title: 'Task done', description: 'Payment checked. One step closer to your reward.' })
    if (!isJoined) setIsJoined(true)
    await fetchAllCampaignData(true)
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

      await recordAttestation(result)

      toast({
        title: 'Task done',
        description: 'One step closer to your reward.',
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
      setTaskErrors((prev) => ({ ...prev, [taskId]: description }))
      toast({ variant: 'destructive', title: 'Couldn’t verify that task', description })
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
        // Refetches keep the page on screen (open dialogs, claim state); only the first load
        // shows the skeleton. Before, every refetch swapped the whole page for a skeleton.
        setIsLoading(true)
        setLoadFailed(false)
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
          setLoadFailed(true)
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast({ title: 'Link copied', description: 'The campaign link is on your clipboard.' })
    } catch {
      toast({ variant: 'destructive', title: 'The link wasn’t copied', description: 'Your browser blocked the clipboard. Copy the address bar instead.' })
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAllCampaignData(true)
    setIsRefreshing(false)
    toast({ title: 'Up to date', description: 'The campaign was read again from the chain.' })
  }

  // "Record the end": endCampaign is permissionless once the end time has passed, so any
  // connected wallet may send it. endCampaign reports its own success / failure toasts.
  const handleRecordEnd = async () => {
    setIsRecordingEnd(true)
    try {
      await endCampaign(campaignId)
      await fetchAllCampaignData(true)
    } catch {
      // The error toast is shown by the service.
    } finally {
      setIsRecordingEnd(false)
    }
  }

  // Check if current user is the host of this campaign
  const isHostOfCampaign =
    role === 'host' &&
    campaign &&
    address?.toLowerCase() === campaign.host.toLowerCase()

  // Shared status model: Open on-chain but past its end time reads as "Ended" everywhere,
  // and tasks are closed. Anyone can record the end (endCampaign is permissionless then).
  const displayStatus = campaign ? getCampaignStatus(campaign) : null
  const isTimeExpiredNotClosed = displayStatus?.state === 'ended_unrecorded'

  useDocumentTitle(campaign?.title)

  if (!campaign && (isLoading || !loadFailed)) {
    return (
      <PageContainer className="pt-4 md:pt-6">
        <h1 className="sr-only">Campaign #{campaignId}</h1>
        <LoadingRegion label="Loading the campaign" className="grid gap-4">
          <Skeleton className="h-11 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-[1.625rem] w-24 rounded-full" />
            <Skeleton className="h-[1.625rem] w-40 rounded-full" />
          </div>
          <Skeleton className="h-12 w-3/4 max-w-xl" />
          <Skeleton className="h-5 w-2/3 max-w-md" />
          <Skeleton className="mt-6 h-4 w-full max-w-3xl" />
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-8">
              <ClaimSkeleton />
              <RowsSkeleton count={3} />
            </div>
            <Skeleton className="h-72 w-full" />
          </div>
        </LoadingRegion>
      </PageContainer>
    )
  }

  if (!campaign) {
    return (
      <PageContainer>
        <h1 className="sr-only">Campaign #{campaignId}</h1>
        <EmptyState
          title={`We couldn’t find campaign #${campaignId}.`}
          body="It doesn’t exist on Sepolia testnet, or the network didn’t answer."
          action={
            <>
              <Button onClick={() => fetchAllCampaignData(true)}>Try again</Button>
              <Button asChild variant="secondary">
                <Link href="/campaigns" prefetch={false}>
                  Browse campaigns
                </Link>
              </Button>
            </>
          }
        />
      </PageContainer>
    )
  }

  return (
    <>
      <CampaignView
        campaign={campaign}
        address={address}
        isConnected={isConnected}
        isHost={!!isHostOfCampaign}
        userTasks={userTasks}
        taskErrors={taskErrors}
        isJoined={isJoined}
        onConnect={connectWallet}
        onStartTask={handleOpenVerifyDialog}
        onRecordEnd={handleRecordEnd}
        isRecordingEnd={isRecordingEnd}
        onCopyLink={handleCopyLink}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onStatusChange={() => fetchAllCampaignData(true)}
        moreNumbers={
          isHostOfCampaign ? (
            <>
              <CampaignFunnelAnalytics campaign={campaign} />
              <CampaignAnalytics campaign={campaign} participants={participants} participantAddresses={participantAddresses} isLoading={isLoading} />
            </>
          ) : undefined
        }
      />
      {/* Task Verification Dialog - Lazy loaded */}
      {verifyingTaskType && (
        <TaskVerificationForm
          isOpen={isVerifyDialogOpen}
          onOpenChange={setIsVerifyDialogOpen}
          taskId={verifyingTaskId}
          taskType={verifyingTaskType}
          campaignId={campaignId}
          task={campaign?.tasks.find((t) => t.id === verifyingTaskId) ?? null}
          onVerify={async (taskId, taskType, discordData, telegramData) => {
            // handleTaskVerification returns a success boolean for the humanity call sites
            // that need to branch on it; this dialog only needs the side effects, so adapt
            // to the Promise<void> shape the form expects.
            await handleTaskVerification(taskId, taskType, discordData, telegramData)
          }}
        />
      )}

      {/* Payment Task Dialog - Lazy loaded */}
      {(() => {
        const index = campaign.tasks.findIndex((t) => t.id === paymentTaskId)
        const task = index === -1 ? null : campaign.tasks[index]
        const request = task ? paymentRequestFromTask(task, DEPLOYMENT_CHAIN.id) : null
        if (!task || !request || !address) return null
        return (
          <PaymentTaskDialog
            open={isPaymentDialogOpen}
            onOpenChange={setIsPaymentDialogOpen}
            campaignId={campaignId}
            taskId={task.id}
            taskIndex={index}
            taskDescription={task.description}
            request={request}
            address={address}
            onVerified={(result) => handlePaymentVerified(task.id, result)}
          />
        )
      })()}

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

    </>
  )
}
