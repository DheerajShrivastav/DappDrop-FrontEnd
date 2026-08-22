'use client'

import { useEffect, useState } from 'react'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import { Trophy, CheckCircle2, Award } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { useWallet } from '@/context/wallet-provider'
import type { Campaign } from '@/lib/types'
import {
  claimTieredReward,
  getTieredRewardStatus,
  getTieredTiers,
  getERC20TokenInfo,
  mapContractRevertToMessage,
  type TieredRewardStatus,
  type TierView,
} from '@/lib/web3-service'
import { SponsoredClaimActions } from './sponsored-claim-actions'

/** Mirrors OnChainRewardLib.matchRankTier/matchScoreTier exactly — display-only preview of
 * what the contract will compute; the actual payout is always contract-computed at claim time. */
function matchTier(
  mode: 'RANK_TIERED' | 'SCORE_TIERED',
  tiers: TierView[],
  rankOrScore: number,
): string | null {
  if (mode === 'RANK_TIERED') {
    const t = tiers.find((t) => rankOrScore >= Number(t.threshold) && rankOrScore <= Number(t.thresholdEnd))
    return t?.amount ?? null
  }
  // Score tiers are matched in stored (descending-threshold) order — the array from getTiers()
  // preserves on-chain storage order, so a plain find() replicates matchScoreTier exactly.
  const t = tiers.find((t) => rankOrScore >= Number(t.threshold))
  return t?.amount ?? null
}

/**
 * Participant self-claim for RANK_TIERED / SCORE_TIERED campaigns (P3 CP1) — the on-chain
 * tiered counterpart of ClaimPanel (which is Merkle-only). No proof, no dispute window: the
 * module computes rank/score and payout purely from on-chain completion state, so this panel
 * never shows any Merkle/root/dispute-window UI — that machinery doesn't apply here.
 */
export function TieredClaimPanel({ campaign }: { campaign: Campaign }) {
  const { address, isConnected } = useWallet()
  const { toast } = useToast()
  const [status, setStatus] = useState<TieredRewardStatus | null>(null)
  const [tiers, setTiers] = useState<TierView[]>([])
  const [tokenInfo, setTokenInfo] = useState<{ decimals: number; symbol: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isClaiming, setIsClaiming] = useState(false)

  const isTiered =
    campaign.settlement?.mode === 'RANK_TIERED' || campaign.settlement?.mode === 'SCORE_TIERED'
  const canClaim = campaign.status === 'Ended' || campaign.status === 'Closed'

  useEffect(() => {
    if (!isConnected || !address || !isTiered || !canClaim) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    Promise.all([
      getTieredRewardStatus(campaign.id, address),
      getTieredTiers(campaign.id),
      campaign.settlement?.erc20Token ? getERC20TokenInfo(campaign.settlement.erc20Token) : null,
    ])
      .then(([s, t, info]) => {
        setStatus(s ?? null)
        setTiers(t)
        setTokenInfo(info)
      })
      .catch(() => setStatus(null))
      .finally(() => setIsLoading(false))
  }, [campaign.id, address, isConnected, isTiered, canClaim, campaign.settlement?.erc20Token])

  if (!isTiered) return null
  if (!isConnected || !address) return null
  if (!canClaim) return null

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-36 rounded-md" />
        </CardContent>
      </Card>
    )
  }

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" /> Your Reward
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Could not read your reward status for this campaign — refresh and try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  const isRank = status.mode === 'RANK_TIERED'
  const rankOrScore = isRank ? status.rank : status.score
  const previewAmount = matchTier(status.mode as 'RANK_TIERED' | 'SCORE_TIERED', tiers, rankOrScore)

  const handleClaim = async () => {
    setIsClaiming(true)
    try {
      await claimTieredReward(campaign.id)
      toast({ title: 'Reward claimed!', description: 'Your tokens have been sent to your wallet.' })
      setStatus({ ...status, claimed: true })
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Claim failed',
        description: mapContractRevertToMessage(e),
      })
    } finally {
      setIsClaiming(false)
    }
  }

  // RANK_TIERED gates claim on CURRENTLY qualified (a since-revoked required task blocks it
  // even though the historical rank stands); SCORE_TIERED has no separate qualified gate —
  // score alone determines the tier, and a zero/too-low score just matches no tier.
  const canActuallyClaim = isRank ? status.qualified && rankOrScore > 0 : rankOrScore > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" /> Your Reward
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Award className="h-3.5 w-3.5" />
          {isRank ? (
            rankOrScore > 0 ? (
              <>Completion rank #{rankOrScore}{!status.qualified && ' (currently not qualified — a required task is incomplete)'}</>
            ) : (
              'Not yet ranked — complete every required task to be assigned a rank.'
            )
          ) : (
            <>Score: {rankOrScore} points</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status.claimed ? (
          <div className="flex items-center gap-2 text-sm text-status-claimable-fg">
            <CheckCircle2 className="h-4 w-4" /> Already claimed.
          </div>
        ) : !canActuallyClaim ? (
          <p className="text-sm text-muted-foreground">
            {isRank
              ? 'You are not currently eligible to claim — complete all required tasks.'
              : 'Your score does not currently qualify for a reward tier.'}
          </p>
        ) : previewAmount === null ? (
          <p className="text-sm text-muted-foreground">
            Your {isRank ? 'rank' : 'score'} does not fall into any configured reward tier.
          </p>
        ) : (
          <SponsoredClaimActions
            campaignId={campaign.id}
            account={address}
            busy={isClaiming}
            onSelfClaim={handleClaim}
            onSponsoredConfirmed={() => setStatus({ ...status, claimed: true })}
            selfClaimLabel={`Claim ${formatAmount(previewAmount, tokenInfo?.decimals ?? null, tokenInfo?.symbol ?? null)}`}
          />
        )}
      </CardContent>
    </Card>
  )
}
