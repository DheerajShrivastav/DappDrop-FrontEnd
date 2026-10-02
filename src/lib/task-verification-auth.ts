import 'server-only'

import { NextResponse } from 'next/server'
import { verifyWalletSession } from '@/app/lib/dal'
import { prisma } from '@/lib/prisma'
import { getEntrypointReadContract } from '@/lib/web3-service'
import { OnChainTaskType, TASK_TYPE_MAP, type TaskType, type TaskTypeSpec } from '@/lib/task-types'

/**
 * Shared guards for the routes that make the platform signer attest a task (verify-task,
 * tasks/verify-payment) or reveal a wallet's task status (tasks/check-payment).
 *
 * Same rule as the sponsored-claims route: the acting wallet is ALWAYS the SIWE session wallet.
 * A wallet address in the request is only cross-checked against it, never used in its place.
 */

/** The session wallet (lowercase), or a 401 response. */
export async function requireSessionWallet(): Promise<{ wallet: string } | { response: NextResponse }> {
  try {
    const { walletAddress } = await verifyWalletSession()
    return { wallet: walletAddress.toLowerCase() }
  } catch {
    return {
      response: NextResponse.json(
        {
          success: false,
          verified: false,
          message: 'Sign in with your wallet to verify tasks.',
          error: 'Not signed in',
        },
        { status: 401 },
      ),
    }
  }
}

/** 403 when the request names a different wallet than the session. Rejects instead of silently
 * substituting: a client acting for another address is a bug or an attempt, and should hear so. */
export function walletMismatchResponse(supplied: unknown, sessionWallet: string): NextResponse | null {
  if (supplied === undefined || supplied === null || supplied === '') return null
  if (typeof supplied === 'string' && supplied.toLowerCase() === sessionWallet) return null
  return NextResponse.json(
    {
      success: false,
      verified: false,
      message: 'This request is for a different wallet than the one you are signed in with.',
      error: 'Wallet mismatch',
    },
    { status: 403 },
  )
}

export type CanonicalTask =
  | { ok: true; type: TaskType }
  | { ok: false; status: 404 | 503; message: string }

/**
 * The task's REAL type, from the chain — never from the request body, which used to pick the
 * verifier. On-chain DISCORD_JOIN covers both Discord and Telegram; the host-written task
 * metadata says which (that route is host-only now). An on-chain type this app doesn't know
 * fails closed instead of defaulting to a task type.
 */
export async function resolveCanonicalTask(campaignId: number, taskIndex: number): Promise<CanonicalTask> {
  let rawType: number
  try {
    const data = await getEntrypointReadContract().getCampaign(campaignId)
    const tasks = (data?.tasks ?? []) as Array<{ taskType: bigint | number }>
    if (taskIndex < 0 || taskIndex >= tasks.length) {
      return { ok: false, status: 404, message: 'Task not found in this campaign.' }
    }
    rawType = Number(tasks[taskIndex].taskType)
  } catch (e) {
    console.error('[task-verification] on-chain task lookup failed:', e)
    return { ok: false, status: 503, message: 'Could not read this task from the chain. Please try again.' }
  }

  if (rawType === OnChainTaskType.DISCORD_JOIN) {
    const meta = await prisma.campaignTaskMetadata.findUnique({
      where: { campaignId_taskIndex: { campaignId, taskIndex } },
      select: { taskType: true },
    })
    return { ok: true, type: meta?.taskType === 'JOIN_TELEGRAM' ? 'JOIN_TELEGRAM' : 'JOIN_DISCORD' }
  }
  const match = (Object.entries(TASK_TYPE_MAP) as [TaskType, TaskTypeSpec][]).find(([, spec]) => spec.onChain === rawType)
  if (!match) return { ok: false, status: 404, message: 'This task has a type the app does not recognise.' }
  return { ok: true, type: match[0] }
}
