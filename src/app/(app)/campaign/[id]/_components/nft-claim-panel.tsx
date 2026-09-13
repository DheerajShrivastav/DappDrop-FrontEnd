'use client'

import { useEffect, useState } from 'react'
import { Trophy, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { useWallet } from '@/context/wallet-provider'
import type { Campaign } from '@/lib/types'
import { claimNFTReward, mapContractRevertToMessage, type NFTStandardLabel } from '@/lib/web3-service'
import { SponsoredClaimActions } from './sponsored-claim-actions'

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
 * Participant self-claim for NFT-mode campaigns (P3 CP2) — the NFT counterpart of ClaimPanel.
 * Same Merkle/24h-dispute-window shape as the ERC20 path, just against NFTSettlementModule and
 * a specific (standard, tokenId) rather than a divisible token amount.
 */
export function NFTClaimPanel({ campaign }: { campaign: Campaign }) {
  const { address, isConnected } = useWallet()
  const { toast } = useToast()
  const [proof, setProof] = useState<NFTAllocationProof | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isClaiming, setIsClaiming] = useState(false)

  const isNFT = campaign.settlement?.mode === 'NFT'

  useEffect(() => {
    if (!isConnected || !address || !isNFT) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    fetch(`/api/campaigns/${campaign.id}/nft-allocation/${address}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setProof)
      .catch(() => setProof(null))
      .finally(() => setIsLoading(false))
  }, [campaign.id, address, isConnected, isNFT])

  if (!isNFT) return null
  if (!isConnected || !address) return null
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
  if (!proof || proof.status === 'not_allocated') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" /> Your Reward
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This wallet has no NFT allocation in this campaign
            {address ? ` — you participated with ${address}.` : '.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleClaim = async () => {
    if (!proof.standard || !proof.tokenId) return
    setIsClaiming(true)
    try {
      await claimNFTReward(campaign.id, proof.standard, proof.tokenAddress, proof.tokenId, proof.amount, proof.proof)
      toast({ title: 'NFT claimed!', description: 'Your NFT has been sent to your wallet.' })
      setProof({ ...proof, status: 'claimed' })
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" /> Your Reward
        </CardTitle>
        <CardDescription>
          {proof.standard} — token ID {proof.tokenId}
          {proof.standard === 'ERC1155' && ` × ${proof.amount}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {proof.status === 'claimed' ? (
          <div className="flex items-center gap-2 text-sm text-status-claimable-fg">
            <CheckCircle2 className="h-4 w-4" /> Already claimed.
          </div>
        ) : proof.status === 'swept' ? (
          <p className="text-sm text-muted-foreground">
            Unclaimed NFTs for this campaign have been swept back to the host. Claiming is closed.
          </p>
        ) : proof.status === 'claimable' ? (
          <SponsoredClaimActions
            campaignId={campaign.id}
            account={address}
            busy={isClaiming}
            onSelfClaim={handleClaim}
            onSponsoredConfirmed={() => setProof({ ...proof, status: 'claimed' })}
            selfClaimLabel={`Claim ${proof.standard} #${proof.tokenId}`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Your allocation isn&apos;t claimable yet — see the status above.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
