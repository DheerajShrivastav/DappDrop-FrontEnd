'use client'

import { useEffect, useState } from 'react'
import type { Campaign } from '@/lib/types'
import { getCampaignStatus } from '@/lib/campaign-status'
import { formatAllocationAmount, formatNFTAllocation } from '@/lib/allocation-format'
import { getTieredRewardStatus, hasParticipated, runWithConcurrencyPublic } from '@/lib/web3-service'

/** A reward this wallet can claim now (the "you have a reward to claim" strip, the gold card line). */
export type WalletReward = {
  campaignId: string
  /** "250 EXAMPLE", "ERC721 #7"; undefined when the amount isn't known here (tiered campaigns). */
  amountLabel?: string
}

export type WalletRewardsState = {
  /** Ids of the campaigns this wallet joined (an empty set until known). */
  joined: ReadonlySet<string>
  rewards: WalletReward[]
}

const EMPTY: WalletRewardsState = { joined: new Set(), rewards: [] }

/**
 * Which campaigns a connected wallet joined, and which of those have a reward it can claim now.
 * Existing data only:
 * - joined: `hasParticipated` (the RPC read the old "Your joined campaigns" strip used);
 * - Merkle ERC20: the public allocation API the claim panel reads (`status === 'claimable'`);
 * - NFT: the public NFT allocation API (`status === 'claimable'`);
 * - tiered: `getTieredRewardStatus` (qualified and not claimed; the amount is shown on the page).
 * Every lookup that fails is just skipped: the strip shows only what's known, never a guess.
 *
 * Behaviour fix vs the old page: it ran only for `role === 'participant'`, so a wallet holding the
 * host role never saw the campaigns it joined elsewhere. It now runs for any connected wallet.
 */
export function useWalletRewards(campaigns: readonly Campaign[], address: string | null): WalletRewardsState {
  const [state, setState] = useState<WalletRewardsState>(EMPTY)

  useEffect(() => {
    if (!address || campaigns.length === 0) {
      setState(EMPTY)
      return
    }
    let cancelled = false
    ;(async () => {
      const flags = await runWithConcurrencyPublic([...campaigns], 4, (c) => hasParticipated(c.id, address).catch(() => false))
      if (cancelled) return
      const joinedList = campaigns.filter((_, i) => flags[i])
      const joined = new Set(joinedList.map((c) => c.id))
      setState({ joined, rewards: [] })

      const now = new Date()
      const claimable = joinedList.filter((c) => getCampaignStatus(c, now).claimable)
      const found = await runWithConcurrencyPublic(claimable, 4, (c) => rewardFor(c, address).catch(() => null))
      if (cancelled) return
      setState({ joined, rewards: found.filter((r): r is WalletReward => r !== null) })
    })()
    return () => {
      cancelled = true
    }
  }, [campaigns, address])

  return state
}

async function rewardFor(c: Campaign, address: string): Promise<WalletReward | null> {
  const mode = c.settlement?.mode
  if (mode === 'MERKLE_ERC20') {
    const res = await fetch(`/api/campaigns/${c.id}/allocation/${address}`)
    if (!res.ok) return null
    const p = (await res.json()) as { status?: string; amount?: string; decimals?: number | null; symbol?: string | null }
    if (p.status !== 'claimable' || !p.amount) return null
    return { campaignId: c.id, amountLabel: formatAllocationAmount(p.amount, p.decimals, p.symbol) }
  }
  if (mode === 'NFT') {
    const res = await fetch(`/api/campaigns/${c.id}/nft-allocation/${address}`)
    if (!res.ok) return null
    const p = (await res.json()) as { status?: string; standard?: string | null; tokenId?: string | null; amount?: string | null }
    if (p.status !== 'claimable') return null
    return { campaignId: c.id, amountLabel: formatNFTAllocation(p.standard, p.tokenId, p.amount) }
  }
  if (mode === 'RANK_TIERED' || mode === 'SCORE_TIERED') {
    const s = await getTieredRewardStatus(c.id, address)
    if (!s || !s.qualified || s.claimed) return null
    return { campaignId: c.id }
  }
  return null
}
