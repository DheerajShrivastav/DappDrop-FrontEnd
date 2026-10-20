'use client'

import { useEffect, useState } from 'react'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import type { Campaign } from '@/lib/types'
import { getTieredLeaderboard, getTieredTiers, getERC20TokenInfo, type LeaderboardEntry, type TierView } from '@/lib/web3-service'
import { SectionHeader } from '@/components/app/page-header'
import { Skeleton } from '@/components/app/states'
import { plural, shortAddress } from '@/components/app/format'
import { amountText, splitAmount } from './reward-panel'

function matchTierAmount(isRank: boolean, tiers: TierView[], rankOrScore: number): string | null {
  const t = isRank
    ? tiers.find((t) => rankOrScore >= Number(t.threshold) && rankOrScore <= Number(t.thresholdEnd))
    : tiers.find((t) => rankOrScore >= Number(t.threshold))
  return t?.amount ?? null
}

/**
 * The leaderboard for a ranked / by-points campaign (P3 CP1): public, worked out entirely on-chain,
 * live as tasks are checked. The tiered counterpart of "The reward list": no list, no 24 hours.
 */
export function TieredLeaderboard({ campaign }: { campaign: Campaign }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [tiers, setTiers] = useState<TierView[]>([])
  const [tokenInfo, setTokenInfo] = useState<{ decimals: number; symbol: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const isTiered = campaign.settlement?.mode === 'RANK_TIERED' || campaign.settlement?.mode === 'SCORE_TIERED'
  const isRank = campaign.settlement?.mode === 'RANK_TIERED'

  useEffect(() => {
    if (!isTiered) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    Promise.all([getTieredLeaderboard(campaign), getTieredTiers(campaign.id), campaign.settlement?.erc20Token ? getERC20TokenInfo(campaign.settlement.erc20Token) : null])
      .then(([lb, t, info]) => {
        if (cancelled) return
        setEntries(lb)
        setTiers(t)
        setTokenInfo(info)
        setFailed(false)
      })
      .catch(() => !cancelled && (setEntries([]), setFailed(true)))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, isTiered])

  if (!isTiered) return null

  const fmt = (raw: string) => amountText(splitAmount(formatAmount(raw, tokenInfo?.decimals ?? null, tokenInfo?.symbol ?? null)))
  const claimedCount = entries.filter((e) => e.claimed).length
  // Tier fill: how many standings land in each configured tier.
  const tierFill = tiers.map((tier) => {
    const count = entries.filter((e) => {
      const v = isRank ? e.rank : e.score
      return isRank
        ? v >= Number(tier.threshold) && v <= Number(tier.thresholdEnd)
        : v >= Number(tier.threshold) && !tiers.some((o) => Number(o.threshold) > Number(tier.threshold) && v >= Number(o.threshold))
    }).length
    return { tier, count }
  })

  return (
    <section id="cp-list" aria-labelledby="cp-board-h">
      <SectionHeader id="cp-board-h" title="The leaderboard" note={isLoading ? undefined : `${plural(entries.length, 'wallet')} · ${claimedCount} claimed`} />
      <p className="mt-3 text-[0.8125rem] text-ink-2">
        {isRank ? 'Ranked by the order wallets finished every required task.' : 'Ranked by task points.'} Worked out on-chain; there’s no list and no
        24-hour wait.
      </p>
      {isLoading ? (
        <div className="mt-4 grid gap-2" aria-busy="true">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : failed ? (
        <p className="mt-4 text-small text-ink-2">
          <span aria-hidden="true" className="mr-1 font-mono font-semibold text-danger">
            !
          </span>
          We couldn’t load the leaderboard. The network didn’t answer; refresh to try again.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {tierFill.length > 0 && (
            <dl className="dd-kv">
              {tierFill.map(({ tier, count }, i) => (
                <div key={i}>
                  <dt>
                    {isRank ? `Rank ${tier.threshold}–${tier.thresholdEnd}` : `${tier.threshold}+ points`} · {fmt(tier.amount)}
                  </dt>
                  <dd>{plural(count, 'wallet')}</dd>
                </div>
              ))}
            </dl>
          )}
          {entries.length === 0 ? (
            <p className="border-y border-rule py-5 text-small text-ink-2">No wallets have qualified yet.</p>
          ) : (
            <div className="cp-scroll" tabIndex={0} role="region" aria-label="The leaderboard, every wallet">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-rule">
                    <th scope="col" className="px-4 py-2">
                      {isRank ? 'Rank' : 'Score'}
                    </th>
                    <th scope="col" className="px-4 py-2">
                      Wallet
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Reward
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const amount = matchTierAmount(isRank, tiers, isRank ? e.rank : e.score)
                    return (
                      <tr key={e.address} className="border-b border-rule font-mono text-[0.8125rem] last:border-0">
                        <td className="px-4 py-2">{isRank ? e.rank : e.score}</td>
                        <td className="px-4 py-2" title={e.address}>
                          {shortAddress(e.address)}
                        </td>
                        <td className="px-4 py-2 text-right">{amount ? fmt(amount) : '—'}</td>
                        <td className="px-4 py-2 text-right text-ink-2">{e.claimed ? 'Claimed' : isRank && !e.qualified ? 'Not qualified' : 'Not claimed'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
