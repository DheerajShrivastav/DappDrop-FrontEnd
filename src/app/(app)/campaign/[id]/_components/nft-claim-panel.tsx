'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Campaign } from '@/lib/types'
import type { CampaignStatusInfo } from '@/lib/campaign-status'
import { claimNFTReward, type NFTStandardLabel } from '@/lib/web3-service'
import { ClaimButtons, RewardPanel, reviewReason, type RewardAmount, type RewardViewState } from './reward-panel'

type NFTAllocationProof = {
  wallet: string
  standard: NFTStandardLabel | null
  tokenAddress: string
  tokenId: string | null
  amount: string
  proof: string[]
  claimableAt: number | null
  status: 'not_allocated' | 'pending_publish' | 'dispute_window' | 'claimable' | 'claimed' | 'swept'
}

/**
 * The NFT claim (P3 CP2): the NFT counterpart of ClaimPanel. Same reward-list and 24-hour review
 * shape, against the campaign's pinned NFTSettlementModule and a specific (standard, tokenId).
 */
export function NFTClaimPanel({
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
  const [proof, setProof] = useState<NFTAllocationProof | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [claimedTx, setClaimedTx] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setClaimedTx(undefined)
    fetch(`/api/campaigns/${campaign.id}/nft-allocation/${address}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((p) => !cancelled && setProof(p))
      .catch(() => !cancelled && setProof(null))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [campaign.id, address])

  const onClaimed = useCallback((tx: string | null) => setClaimedTx(tx), [])

  // "#12" big, "ERC721" (or "ERC1155 × 3") as the unit.
  const amount: RewardAmount | null =
    proof && proof.standard && proof.tokenId != null
      ? { value: `#${proof.tokenId}`, unit: proof.standard === 'ERC1155' && proof.amount && proof.amount !== '1' ? `${proof.standard} × ${proof.amount}` : proof.standard }
      : proof
        ? { value: 'NFT' }
        : null

  let view: RewardViewState
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

  const claim = async () => {
    if (!proof?.standard || !proof.tokenId) throw new Error('This allocation is missing its token details. Refresh and try again.')
    return claimNFTReward(campaign.id, proof.standard, proof.tokenAddress, proof.tokenId, proof.amount, proof.proof)
  }

  const actions =
    (view.kind === 'claimable' || view.kind === 'review') && proof ? (
      <ClaimButtons
        campaignId={campaign.id}
        address={address}
        amountLabel={proof.standard && proof.tokenId ? `${proof.standard} #${proof.tokenId}` : 'your NFT'}
        claim={claim}
        onClaimed={onClaimed}
        disabledReason={view.kind === 'review' ? reviewReason(view.claimsOpenAt) : undefined}
        successTitle="NFT claimed"
        successBody="Your NFT has been sent to your wallet."
      />
    ) : null

  return <RewardPanel view={view} address={address} nft actions={actions} deadline={deadline} report={report} />
}
