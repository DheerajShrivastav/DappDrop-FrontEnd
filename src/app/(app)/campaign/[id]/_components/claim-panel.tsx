'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import type { Campaign } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { claimERC20Reward } from '@/lib/web3-service'
import { ClaimButtons, RewardPanel, amountText, reviewReason, splitAmount, type RewardViewState } from './reward-panel'

type AllocationProof = {
  wallet: string
  amount: string
  proof: string[]
  claimableAt: number | null
  status: 'not_allocated' | 'pending_publish' | 'dispute_window' | 'claimable' | 'claimed' | 'swept'
  decimals: number | null
  symbol: string | null
}

/**
 * The ERC20 reward-list claim (PRD FR-C1/C2) for the connected wallet. Reads the wallet's proof
 * from /api/campaigns/:id/allocation/:wallet (which cross-checks the live on-chain root) and maps
 * it onto the claim panel: not on the list · inside the 24-hour review (buttons disabled, with the
 * time in words) · claimable (gas-free first, the wallet claim always live) · claimed · swept.
 * Every revert is mapped to a specific message (NFR-10) by ClaimButtons.
 */
export function ClaimPanel({
  campaign,
  status,
  address,
  deadline,
  report,
}: {
  campaign: Campaign
  status: CampaignStatusInfo
  address: string
  deadline?: ReactNode
  report?: ReactNode
}) {
  const [proof, setProof] = useState<AllocationProof | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [claimedTx, setClaimedTx] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    // Out-of-order guard: a wallet switch mid-flight must not show the previous wallet's proof.
    let cancelled = false
    setIsLoading(true)
    setClaimedTx(undefined)
    fetch(`/api/campaigns/${campaign.id}/allocation/${address}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((p) => !cancelled && setProof(p))
      .catch(() => !cancelled && setProof(null))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [campaign.id, address])

  const onClaimed = useCallback((tx: string | null) => setClaimedTx(tx), [])

  let view: RewardViewState
  const amount = proof ? splitAmount(formatAmount(proof.amount, proof.decimals, proof.symbol)) : null
  if (isLoading) view = { kind: 'checking' }
  else if (!proof || proof.status === 'not_allocated') {
    if (status.state === 'swept') return null
    view = { kind: 'not-on-list' }
  } else if (claimedTx !== undefined || proof.status === 'claimed') view = { kind: 'claimed', amount: amount!, txHash: claimedTx }
  else if (proof.status === 'swept') view = { kind: 'swept', endedOn: status.sweepEligibleAt }
  else if (proof.status === 'pending_publish') view = { kind: 'waiting-list', tasksDone: true }
  else if (proof.status === 'dispute_window')
    view = { kind: 'review', amount: amount!, claimsOpenAt: proof.claimableAt ? new Date(proof.claimableAt * 1000) : status.claimsOpenAt }
  else view = { kind: 'claimable', amount: amount! }

  const actions =
    (view.kind === 'claimable' || view.kind === 'review') && proof ? (
      <ClaimButtons
        campaignId={campaign.id}
        address={address}
        amountLabel={amountText(view.amount)}
        claim={() => claimERC20Reward(campaign.id, proof.amount, proof.proof)}
        onClaimed={onClaimed}
        disabledReason={view.kind === 'review' ? reviewReason(view.claimsOpenAt) : undefined}
        successBody="Your tokens have been sent to your wallet."
      />
    ) : null

  return <RewardPanel view={view} address={address} actions={actions} deadline={deadline} report={report} />
}
