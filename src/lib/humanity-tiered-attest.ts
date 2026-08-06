import 'server-only'

import { prisma } from './prisma'
import { attestTaskCompletion } from './signer'
import { hasCompletedTaskOnChain, getEntrypointReadContract } from './web3-service'

/**
 * Proactive HUMANITY_VERIFICATION attestation on OAuth callback — docs/HUMANITY_GATING.md
 * point 3 ("On Humanity OAuth callback: ... for any active humanity-gated tiered campaign the
 * wallet participates in, sign and submit the HUMANITY_VERIFICATION attestation"). Deferred
 * from CP2 to CP1 because it's only reachable once a tiered campaign can actually require
 * HUMANITY_VERIFICATION as a required task — CP1 is what makes that task type meaningful.
 *
 * Why this exists ALONGSIDE the already-working reactive path: HUMANITY_VERIFICATION tasks in
 * ANY campaign (Merkle or tiered) already get attested through the ordinary
 * POST /api/verify-task -> attestTaskCompletion flow once isUserVerified() is true — a
 * participant who visits a campaign and clicks "verify" on the task gets attested exactly like
 * any other task type. This function's job is narrower: fire that same attestation immediately
 * at OAuth-callback time, for humanity-gated tiered campaigns, WITHOUT requiring the participant
 * to separately visit and click verify per campaign — "one OAuth, once per wallet, ever" per the
 * doc's stated end-user experience.
 *
 * Scope is bounded to keep this cheap and safe to run inline in the OAuth callback response:
 * only campaigns that are (a) humanity-gated (CampaignCache.humanityGated) AND (b) have an
 * actual HUMANITY_VERIFICATION task in CampaignTaskMetadata — both known from the DB, no RPC
 * scan of "every campaign" needed. Whether the campaign ended up tiered vs Merkle doesn't need
 * to be checked here: attesting a HUMANITY_VERIFICATION task is harmless for a Merkle campaign
 * too (it's just a signed "task N complete" record; Merkle enforcement is the tree filter, not
 * this task), so no extra on-chain mode read is needed before deciding whether to attest.
 */

async function isCampaignAttestable(campaignId: number): Promise<boolean> {
  try {
    const c = getEntrypointReadContract()
    const campaign = await c.getCampaign(campaignId)
    const status = Number(campaign.status)
    // 1 = Open, 2 = Ended (CampaignStatus enum) — attestation is meaningless before Open and
    // moot after Closed (claims already frozen/settled by then).
    return status === 1 || status === 2
  } catch {
    return false
  }
}

export type AutoAttestResult = {
  attempted: number
  attested: number
  errors: string[]
}

/**
 * Best-effort, never throws — called from the verify-humanity route AFTER the OAuth
 * verification itself already succeeded and was persisted. A failure here must never turn a
 * successful humanity verification into an error response.
 */
export async function autoAttestHumanityTasksForWallet(
  walletAddress: string,
): Promise<AutoAttestResult> {
  const result: AutoAttestResult = { attempted: 0, attested: 0, errors: [] }

  let candidates: { campaignId: number; taskIndex: number }[]
  try {
    const gatedCampaigns = await prisma.campaignCache.findMany({
      where: { humanityGated: true },
      select: { campaignId: true },
    })
    if (gatedCampaigns.length === 0) return result

    const tasks = await prisma.campaignTaskMetadata.findMany({
      where: {
        taskType: 'HUMANITY_VERIFICATION',
        campaignId: { in: gatedCampaigns.map((c) => c.campaignId) },
      },
      select: { campaignId: true, taskIndex: true },
    })
    candidates = tasks
  } catch (e) {
    result.errors.push(`DB lookup failed: ${(e as Error).message}`)
    return result
  }

  for (const { campaignId, taskIndex } of candidates) {
    result.attempted++
    try {
      const [attestable, alreadyDone] = await Promise.all([
        isCampaignAttestable(campaignId),
        hasCompletedTaskOnChain(campaignId, walletAddress, taskIndex),
      ])
      if (!attestable || alreadyDone) continue

      await attestTaskCompletion({
        campaignId,
        participant: walletAddress,
        taskIndex,
        completed: true,
        evidence: { source: 'humanity-oauth-callback-auto-attest' },
      })
      result.attested++
    } catch (e) {
      // Rate-limit/concurrency errors are expected/benign here (e.g. the participant also
      // clicked "verify" on the task manually at nearly the same moment) — log, don't fail.
      result.errors.push(`campaign ${campaignId} task ${taskIndex}: ${(e as Error).message}`)
    }
  }

  return result
}
