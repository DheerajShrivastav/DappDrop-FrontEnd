'use client'

import { useEffect, useState } from 'react'
import { isAddress } from 'viem'
import { inspectRewardToken, type RewardTokenInspection } from '@/lib/web3-service'

export type RewardTokenCheck =
  | { status: 'idle' } // no valid address yet
  | { status: 'checking' }
  | { status: 'done'; result: RewardTokenInspection }

/**
 * Debounced pre-flight check of the reward token the host has typed (see inspectRewardToken).
 * Re-runs when the address, standard, owner or NFT rows change; stale responses from an earlier
 * input are dropped so a slow lookup can't overwrite a newer one.
 */
export function useRewardTokenCheck(params: {
  tokenAddress: string | undefined
  owner: string | null | undefined
  kind: 'ERC20' | 'ERC721' | 'ERC1155' | null
  items?: { id: string; qty: string }[]
}): RewardTokenCheck {
  const [check, setCheck] = useState<RewardTokenCheck>({ status: 'idle' })
  const itemsKey = JSON.stringify(params.items ?? [])

  useEffect(() => {
    const addr = params.tokenAddress?.trim()
    if (!params.kind || !addr || !isAddress(addr)) {
      setCheck({ status: 'idle' })
      return
    }
    let cancelled = false
    setCheck({ status: 'checking' })
    const t = setTimeout(() => {
      inspectRewardToken({
        tokenAddress: addr,
        owner: params.owner,
        kind: params.kind!,
        items: params.items,
      })
        .then((result) => {
          if (!cancelled) setCheck({ status: 'done', result })
        })
        .catch(() => {
          if (!cancelled) setCheck({ status: 'done', result: { kind: 'error' } })
        })
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tokenAddress, params.owner, params.kind, itemsKey])

  return check
}
