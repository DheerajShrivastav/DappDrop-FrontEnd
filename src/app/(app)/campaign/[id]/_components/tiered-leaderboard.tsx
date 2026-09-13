'use client'

import { useEffect, useState } from 'react'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import { Trophy } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import type { Campaign } from '@/lib/types'
import {
  getTieredLeaderboard,
  getTieredTiers,
  getERC20TokenInfo,
  type LeaderboardEntry,
  type TierView,
} from '@/lib/web3-service'

function matchTierAmount(
  isRank: boolean,
  tiers: TierView[],
  rankOrScore: number,
): string | null {
  const t = isRank
    ? tiers.find((t) => rankOrScore >= Number(t.threshold) && rankOrScore <= Number(t.thresholdEnd))
    : tiers.find((t) => rankOrScore >= Number(t.threshold))
  return t?.amount ?? null
}

/**
 * Leaderboard + tier-fill + claim progress for a tiered campaign (P3 CP1 "Dashboard" scope).
 * Visible to anyone (both host and participants — leaderboards are public in this class of
 * platform); no root/dispute-window UI appears here, matching the rest of the tiered path.
 */
export function TieredLeaderboard({ campaign }: { campaign: Campaign }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [tiers, setTiers] = useState<TierView[]>([])
  const [tokenInfo, setTokenInfo] = useState<{ decimals: number; symbol: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isTiered =
    campaign.settlement?.mode === 'RANK_TIERED' || campaign.settlement?.mode === 'SCORE_TIERED'
  const isRank = campaign.settlement?.mode === 'RANK_TIERED'

  useEffect(() => {
    if (!isTiered) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    Promise.all([
      getTieredLeaderboard(campaign),
      getTieredTiers(campaign.id),
      campaign.settlement?.erc20Token ? getERC20TokenInfo(campaign.settlement.erc20Token) : null,
    ])
      .then(([lb, t, info]) => {
        setEntries(lb)
        setTiers(t)
        setTokenInfo(info)
      })
      .catch(() => setEntries([]))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, isTiered])

  if (!isTiered) return null

  const claimedCount = entries.filter((e) => e.claimed).length
  // Tier fill: how many standings currently land in each configured tier.
  const tierFill = tiers.map((tier) => {
    const count = entries.filter((e) => {
      const v = isRank ? e.rank : e.score
      return isRank
        ? v >= Number(tier.threshold) && v <= Number(tier.thresholdEnd)
        : v >= Number(tier.threshold) &&
            // exclusive of the next-higher tier's threshold, since matching picks the highest
            !tiers.some(
              (other) =>
                Number(other.threshold) > Number(tier.threshold) &&
                v >= Number(other.threshold),
            )
    }).length
    return { tier, count }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" /> Leaderboard
        </CardTitle>
        <CardDescription>
          {isRank ? 'Ranked by completion order' : 'Ranked by task-point score'} — computed
          entirely on-chain, updates live as tasks are verified. No dispute window applies to
          this campaign.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              {entries.length} qualifying wallet(s) · {claimedCount} claimed
            </div>

            {tierFill.length > 0 && (
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tier fill
                </p>
                {tierFill.map(({ tier, count }, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      {isRank
                        ? `Rank ${tier.threshold}–${tier.thresholdEnd}`
                        : `Score ≥ ${tier.threshold}`}{' '}
                      — {formatAmount(tier.amount, tokenInfo?.decimals ?? null, tokenInfo?.symbol ?? null)}
                    </span>
                    <span className="text-muted-foreground">{count} wallet(s)</span>
                  </div>
                ))}
              </div>
            )}

            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No wallets have qualified yet.
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRank ? 'Rank' : 'Score'}</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead className="text-right">Tier reward</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => {
                      const amount = matchTierAmount(isRank, tiers, isRank ? e.rank : e.score)
                      return (
                        <TableRow key={e.address}>
                          <TableCell>{isRank ? e.rank : e.score}</TableCell>
                          <TableCell className="font-mono text-xs">{e.address}</TableCell>
                          <TableCell className="text-right">
                            {amount
                              ? formatAmount(amount, tokenInfo?.decimals ?? null, tokenInfo?.symbol ?? null)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {e.claimed ? 'Claimed' : isRank && !e.qualified ? 'Not qualified' : 'Unclaimed'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
