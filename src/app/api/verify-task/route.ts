// src/app/api/verify-task/route.ts
import { NextResponse } from 'next/server'
import {
  verifyDiscordJoin,
  verifyTelegramJoin,
} from '@/lib/verification-service'
import { isUserVerified } from '@/lib/humanity-service'
import { prisma } from '@/lib/prisma'
import { type AttestationEvidence } from '@/lib/signer'
import { attestAndRespond } from '@/lib/attest-response'
import { accountUsedByAnotherWallet, getLinkedAccounts } from '@/lib/social-identity'
import { TASK_VERIFICATION_METHOD } from '@/lib/task-types'
import {
  requireSessionWallet,
  resolveCanonicalTask,
  walletMismatchResponse,
} from '@/lib/task-verification-auth'

/** Best-effort, never throws — a logging failure must never break the verify-task response
 * itself. No wallet/user identifier stored (P3 CP3 host analytics: aggregated only). */
async function logVerificationFailure(
  campaignId: number,
  taskIndex: number,
  taskType: string | undefined,
  reason: string,
): Promise<void> {
  try {
    await prisma.verificationFailure.create({
      data: { campaignId, taskIndex, taskType: taskType ?? null, reason },
    })
  } catch (e) {
    console.warn('[verify-task] failed to log verification failure (non-fatal):', e)
  }
}

/**
 * POST /api/verify-task — check a task server-side and, on PASS, have the platform signer attest
 * it for the SIGNED-IN wallet.
 *
 * Fail-closed rules (this route makes the signer vouch on-chain, so every one matters):
 *   - the acting wallet is the SIWE session wallet; a body `userAddress` is only cross-checked
 *   - the task's type comes from the chain, not the request body
 *   - each type passes only by its own rule in TASK_VERIFICATION_METHOD; a type without one
 *     (or that the chain reports but the app doesn't know) is never attested
 *   - self-reported tasks are attested on the participant's word but recorded as such in the
 *     attestation audit log (method: 'self-reported'), never dressed up as a real check
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSessionWallet()
    if ('response' in auth) return auth.response
    const wallet = auth.wallet

    const body = await request.json()
    const {
      taskType: claimedTaskType, // informational only — never used to pick the verifier
      campaignId: campaignIdRaw,
      taskId,
      userAddress,
      // discordId / discordUsername / telegramUserId / telegramUsername may still arrive from older
      // clients and are deliberately IGNORED: membership is checked only for the account linked to
      // this wallet server-side (Discord OAuth / Telegram Login Widget, see social-identity.ts).
    } = body

    const mismatch = walletMismatchResponse(userAddress, wallet)
    if (mismatch) return mismatch

    // Normalize to numbers
    const campaignId =
      typeof campaignIdRaw === 'number'
        ? campaignIdRaw
        : parseInt(campaignIdRaw, 10)
    const taskIndex = parseInt(taskId, 10)

    if (isNaN(campaignId) || isNaN(taskIndex)) {
      return NextResponse.json(
        { error: 'Invalid campaignId or taskId' },
        { status: 400 },
      )
    }

    const canonical = await resolveCanonicalTask(campaignId, taskIndex)
    if (!canonical.ok) {
      await logVerificationFailure(campaignId, taskIndex, undefined, 'task_lookup_failed')
      return NextResponse.json(
        { success: false, verified: false, message: canonical.message },
        { status: canonical.status },
      )
    }
    const taskType = canonical.type
    if (claimedTaskType && claimedTaskType !== taskType) {
      console.warn('[verify-task] client-sent taskType differs from the on-chain task; using on-chain', {
        campaignId,
        taskIndex,
        claimedTaskType,
        taskType,
      })
    }

    const method = TASK_VERIFICATION_METHOD[taskType]
    if (method === 'payment') {
      // Payments are verified (and attested) only by /api/tasks/verify-payment, which checks the
      // transaction actually came from this wallet.
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: 'Submit your payment transaction to complete this task.',
        },
        { status: 400 },
      )
    }
    if (method === 'contract') {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message: 'Holding tasks are verified by the contract itself — complete them from the campaign page.',
        },
        { status: 400 },
      )
    }

    // Self-reported (Twitter tasks, no automatic X check yet) and WALLET_CONNECT (the session is
    // the proof). Both attest ONLY for the session wallet; the method is written into the evidence
    // so the audit log can always tell these apart from a real check. The signer's unique
    // (campaign, task, participant, version) record keeps it to one attestation per wallet per task.
    if (method === 'self-reported' || method === 'siwe-session') {
      return attestAndRespond(campaignId, taskIndex, wallet, {
        taskType,
        method,
        checkedAt: new Date().toISOString(),
      })
    }

    let isVerified = false
    // Evidence snapshot persisted with the signature (BR-V4 audit log).
    let evidence: AttestationEvidence = { taskType }

    // Discord / Telegram configuration written by the campaign's host.
    const taskMetadata = await prisma.campaignTaskMetadata.findUnique({
      where: {
        campaignId_taskIndex: {
          campaignId,
          taskIndex,
        },
      },
    })

    if (taskType === 'JOIN_DISCORD') {
      // Discord verification - use stored server ID from dedicated column
      const discordServerId = taskMetadata?.discordServerId

      if (!discordServerId) {
        await logVerificationFailure(campaignId, taskIndex, taskType, 'discord_not_configured')
        return NextResponse.json({
          success: false,
          verified: false,
          message: 'Discord server ID not found for this task',
          internalError: true,
        })
      }

      const discord = (await getLinkedAccounts(wallet)).discord
      if (!discord) {
        await logVerificationFailure(campaignId, taskIndex, taskType, 'discord_not_linked')
        return NextResponse.json({
          success: false,
          verified: false,
          needsLink: 'discord',
          message: 'Connect your Discord account first.',
        })
      }
      if (await accountUsedByAnotherWallet({ platform: 'discord', accountId: discord.id, campaignId, taskIndex, wallet })) {
        await logVerificationFailure(campaignId, taskIndex, taskType, 'discord_account_reused')
        return NextResponse.json({
          success: false,
          verified: false,
          message: 'This Discord account has already completed this task for another wallet.',
        })
      }
      isVerified = await verifyDiscordJoin(discord.username ?? '', discordServerId, discord.id)
      evidence = {
        taskType,
        platform: 'discord',
        discordServerId,
        discordId: discord.id,
        method: 'linked-oauth',
        checkedAt: new Date().toISOString(),
      }

      if (isVerified) {
        const existingVerification = await prisma.socialVerification.findFirst({
          where: {
            userAddress: wallet,
            taskId: `${campaignId}-${taskIndex}`,
            platform: 'DISCORD',
            isValid: true,
          },
        })

        if (!existingVerification) {
          await prisma.socialVerification.create({
            data: {
              userAddress: wallet,
              taskId: `${campaignId}-${taskIndex}`,
              platform: 'DISCORD',
              proofData: {
                username: discord.username,
                discordId: discord.id,
                serverId: discordServerId,
                verificationMethod: 'linked-oauth',
                verificationTime: new Date().toISOString(),
              },
              verifiedAt: new Date(),
              isValid: true,
            },
          })
        }
      }
    } else if (taskType === 'JOIN_TELEGRAM') {
      const telegramChatId = taskMetadata?.telegramChatId
      if (!telegramChatId) {
        console.warn('Telegram task missing chat ID metadata', {
          campaignId,
          taskIndex,
        })
        await logVerificationFailure(campaignId, taskIndex, taskType, 'telegram_not_configured')
        return NextResponse.json({
          success: false,
          verified: false,
          message: 'Telegram chat ID is not configured for this task',
          internalError: true,
        })
      }

      const telegram = (await getLinkedAccounts(wallet)).telegram
      if (!telegram) {
        await logVerificationFailure(campaignId, taskIndex, taskType, 'telegram_not_linked')
        return NextResponse.json({
          success: false,
          verified: false,
          needsLink: 'telegram',
          message: 'Connect your Telegram account first.',
        })
      }
      if (await accountUsedByAnotherWallet({ platform: 'telegram', accountId: telegram.id, campaignId, taskIndex, wallet })) {
        await logVerificationFailure(campaignId, taskIndex, taskType, 'telegram_account_reused')
        return NextResponse.json({
          success: false,
          verified: false,
          message: 'This Telegram account has already completed this task for another wallet.',
        })
      }
      isVerified = await verifyTelegramJoin(telegram.username ?? '', telegramChatId, telegram.id)
      evidence = {
        taskType,
        platform: 'telegram',
        telegramChatId,
        telegramUserId: telegram.id,
        method: 'linked-login-widget',
        checkedAt: new Date().toISOString(),
      }

      if (isVerified) {
        const existingVerification = await prisma.socialVerification.findFirst({
          where: {
            userAddress: wallet,
            taskId: `${campaignId}-${taskIndex}`,
            platform: 'TELEGRAM',
            isValid: true,
          },
        })

        if (!existingVerification) {
          await prisma.socialVerification.create({
            data: {
              userAddress: wallet,
              taskId: `${campaignId}-${taskIndex}`,
              platform: 'TELEGRAM',
              proofData: {
                username: telegram.username,
                userId: telegram.id,
                chatId: telegramChatId,
                verificationMethod: 'linked-login-widget',
                verificationTime: new Date().toISOString(),
              },
              verifiedAt: new Date(),
              isValid: true,
            },
          })
        }
      }
    } else if (taskType === 'HUMANITY_VERIFICATION') {
      // In v2, verification happens via OAuth flow on the client; the callback caches the
      // result, and this checks it for the SESSION wallet.
      try {
        const isHuman = await isUserVerified(wallet)
        if (!isHuman) {
          await logVerificationFailure(campaignId, taskIndex, taskType, 'humanity_pending')
          return NextResponse.json(
            {
              success: false,
              verified: false,
              message:
                'Humanity verification pending. Please complete the Humanity Protocol verification and try again shortly.',
              error:
                'Humanity verification pending. Please complete the Humanity Protocol verification and try again shortly.',
            },
            { status: 403 },
          )
        }
        isVerified = true
        evidence = {
          taskType,
          platform: 'humanity',
          isHuman,
          checkedAt: new Date().toISOString(),
        }
      } catch (error: any) {
        console.error('Error checking humanity verification:', error)
        return NextResponse.json(
          {
            success: false,
            verified: false,
            message: 'Error checking verification status',
            error: error.message || 'Database error',
          },
          { status: 500 },
        )
      }
    } else {
      // Unreachable while TASK_VERIFICATION_METHOD and the branches above agree — but if a method
      // is ever added without a branch here, the task must fail, not pass.
      console.warn('[verify-task] verifiable type without a verifier branch — failing closed', {
        campaignId,
        taskIndex,
        taskType,
      })
      await logVerificationFailure(campaignId, taskIndex, taskType, 'no_verifier')
      return NextResponse.json({
        success: false,
        verified: false,
        message: 'This task type cannot be verified.',
        internalError: true,
      })
    }

    if (!isVerified) {
      const reason =
        taskType === 'JOIN_DISCORD'
          ? 'discord_not_joined'
          : taskType === 'JOIN_TELEGRAM'
            ? 'telegram_not_joined'
            : 'verification_failed'
      await logVerificationFailure(campaignId, taskIndex, taskType, reason)
      return NextResponse.json({
        success: true,
        verified: false,
        message: 'Task verification failed',
      })
    }

    // PASS → sign (and best-effort submit) the EIP-712 attestation for the session wallet, and
    // return the signature for self-submit fallback. Hold tasks are rejected inside the signer.
    return attestAndRespond(campaignId, taskIndex, wallet, evidence)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 },
    )
  }
}
