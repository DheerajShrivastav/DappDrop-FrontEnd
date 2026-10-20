'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import type { Campaign } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import {
  claimTieredReward,
  getTieredRewardStatus,
  getTieredTiers,
  getERC20TokenInfo,
  type TieredRewardStatus,
  type TierView,
} from '@/lib/web3-service'
import { ClaimButtons, RewardPanel, amountText, splitAmount, type RewardViewState } from './reward-panel'

/** Mirrors OnChainRewardLib.matchRankTier/matchScoreTier exactly: a display-only preview of what
 * the contract will compute; the actual payout is always contract-computed at claim time. */
export function matchTier(mode: 'RANK_TIERED' | 'SCORE_TIERED', tiers: TierView[], rankOrScore: number): string | null {
  if (mode === 'RANK_TIERED') {
    const t = tiers.find((t) => rankOrScore >= Number(t.threshold) && rankOrScore <= Number(t.thresholdEnd))
    return t?.amount ?? null
  }
  // Score tiers are matched in stored (descending-threshold) order, as getTiers() returns them.
  const t = tiers.find((t) => rankOrScore >= Number(t.threshold))
  return t?.amount ?? null
}

/**
 * The ranked / by-points claim (P3 CP1). No list and no 24-hour review: the module works out rank
 * or score and the payout from on-chain completions, so this never shows list UI.
 */
export function TieredClaimPanel({
  campaign,
  status: lifecycle,
  address,
  deadline,
}: {
  campaign: Campaign
  status: CampaignStatusInfo
  address: string
  deadline?: ReactNode
}) {
  const [status, setStatus] = useState<TieredRewardStatus | null>(null)
  const [tiers, setTiers] = useState<TierView[]>([])
  const [tokenInfo, setTokenInfo] = useState<{ decimals: number; symbol: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [claimedTx, setClaimedTx] = useState<string | null | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setClaimedTx(undefined)
    Promise.all([
      getTieredRewardStatus(campaign.id, address),
      getTieredTiers(campaign.id),
      campaign.settlement?.erc20Token ? getERC20TokenInfo(campaign.settlement.erc20Token) : null,
    ])
      .then(([s, t, info]) => {
        if (cancelled) return
        setStatus(s ?? null)
        setTiers(t)
        setTokenInfo(info)
      })
      .catch(() => !cancelled && setStatus(null))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [campaign.id, address, campaign.settlement?.erc20Token, attempt])

  const onClaimed = useCallback((tx: string | null) => setClaimedTx(tx), [])

  if (lifecycle.state === 'swept') return <RewardPanel view={{ kind: 'swept', endedOn: lifecycle.sweepEligibleAt }} />

  let view: RewardViewState
  let rankLine: string | undefined
  let amountLabel = ''
  if (isLoading) view = { kind: 'checking' }
  else if (!status) view = { kind: 'error', message: 'We couldn’t read your reward from the contract. The network didn’t answer.' }
  else {
    const isRank = status.mode === 'RANK_TIERED'
    const rankOrScore = isRank ? status.rank : status.score
    const preview = matchTier(status.mode as 'RANK_TIERED' | 'SCORE_TIERED', tiers, rankOrScore)
    const amount = preview ? splitAmount(formatAmount(preview, tokenInfo?.decimals ?? null, tokenInfo?.symbol ?? null)) : undefined
    amountLabel = amount ? amountText(amount) : ''
    if (rankOrScore > 0) rankLine = isRank ? `Completion rank #${rankOrScore}` : `Score: ${rankOrScore} points`
    // RANK_TIERED gates the claim on CURRENTLY qualified (a since-revoked required task blocks it
    // even though the rank stands); SCORE_TIERED has no separate gate: a low score matches no tier.
    const canClaim = isRank ? status.qualified && rankOrScore > 0 : rankOrScore > 0
    if (claimedTx !== undefined || status.claimed) view = { kind: 'claimed', amount, txHash: claimedTx }
    else if (!canClaim)
      view = {
        kind: 'not-eligible',
        message: isRank
          ? rankOrScore > 0
            ? 'A required task isn’t done any more, so this wallet can’t claim right now. Finish every required task to claim.'
            : 'Not ranked yet: finish every required task to get a rank.'
          : 'Your score doesn’t reach a reward tier.',
      }
    else if (!amount) view = { kind: 'not-eligible', message: `Your ${isRank ? 'rank' : 'score'} doesn’t fall into any reward tier.` }
    else view = { kind: 'claimable', amount }
  }

  const actions =
    view.kind === 'claimable' ? (
      <ClaimButtons
        campaignId={campaign.id}
        address={address}
        amountLabel={amountLabel}
        claim={() => claimTieredReward(campaign.id)}
        onClaimed={onClaimed}
        successBody="Your tokens have been sent to your wallet."
      />
    ) : null

  return <RewardPanel view={view} address={address} rankLine={rankLine} actions={actions} deadline={deadline} onRetry={() => setAttempt((a) => a + 1)} />
}
