import { getEntrypointReadContract } from '@/lib/web3-service'

/**
 * Who qualifies for a Merkle (ERC20 equal-split / NFT) allocation: wallets that completed every
 * REQUIRED task. Optional tasks don't count — the same rule the contract applies to tiered
 * campaigns (_hasCompletedAllRequiredTasks).
 *
 * This used to be `tasksCompleted >= totalTasks`, i.e. every task including optional ones. That
 * was harmless while the wizard marked every task required, but self-reported tasks now default
 * to optional, and under the old rule anyone who skipped one would silently get no allocation.
 *
 * Optional flags are read from the chain (BR-I4: the chain is for money), not from cached data.
 */

type ParticipantLike = { address: string; tasksCompleted: number }

type TaskCompletionReader = {
  getCampaign: (campaignId: number) => Promise<{ tasks: Array<{ isOptional: boolean }> }>
  hasCompletedTask: (campaignId: number, participant: string, taskIndex: number) => Promise<boolean>
}

const CONCURRENCY = 5

export async function filterQualifyingParticipants<P extends ParticipantLike>(
  campaignId: number,
  participants: P[],
  reader: TaskCompletionReader = getEntrypointReadContract() as unknown as TaskCompletionReader,
): Promise<P[]> {
  const onChain = await reader.getCampaign(campaignId)
  const tasks = onChain.tasks ?? []
  const required = tasks.map((t, i) => (t.isOptional ? -1 : i)).filter((i) => i >= 0)

  // No optional tasks: every task is required, so the completion count alone decides — exactly
  // the previous behaviour, with no extra RPC calls.
  if (required.length === tasks.length) {
    return participants.filter((p) => p.tasksCompleted >= tasks.length)
  }

  // Some tasks are optional: a count can't tell WHICH tasks were done, so check each required
  // task for every wallet that has at least that many completions.
  // At least one completion either way: the contract only marks a wallet qualified on an actual
  // completion, so an all-optional campaign must not pay a wallet that did nothing.
  const candidates = participants.filter((p) => p.tasksCompleted >= Math.max(1, required.length))
  const keep: P[] = []
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (p) => {
        for (const taskIndex of required) {
          if (!(await reader.hasCompletedTask(campaignId, p.address, taskIndex))) return false
        }
        return true
      }),
    )
    results.forEach((ok, j) => ok && keep.push(batch[j]))
  }
  return keep
}
