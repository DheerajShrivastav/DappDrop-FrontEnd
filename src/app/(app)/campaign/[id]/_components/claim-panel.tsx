'use client'

import { useEffect, useState } from 'react'
import { formatAllocationAmount as formatAmount } from '@/lib/allocation-format'
import { Trophy, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { useWallet } from '@/context/wallet-provider'
import type { Campaign } from '@/lib/types'
import { claimERC20Reward, mapContractRevertToMessage } from '@/lib/web3-service'
import { getLifecycleState } from '@/lib/campaign-lifecycle'
import { SponsoredClaimActions } from './sponsored-claim-actions'

type AllocationProof = {
  wallet: string
  amount: string
  proof: string[]
  claimableAt: number | null
  status:
    | 'not_allocated'
    | 'pending_publish'
    | 'dispute_window'
    | 'claimable'
    | 'claimed'
    | 'swept'
  decimals: number | null
  symbol: string | null
}

/**
 * Participant self-claim (PRD FR-C1/C2, no relayer yet — sponsorship is P2). Only renders a
 * claim ACTION once the lifecycle ladder (src/lib/campaign-lifecycle.ts) says the dispute
 * window has actually elapsed — before that, the state banner already elsewhere on the page
 * explains why. Every relevant revert maps to a specific message (NFR-10).
 */
export function ClaimPanel({ campaign }: { campaign: Campaign }) {
  const { address, isConnected } = useWallet()
  const { toast } = useToast()
  const [proof, setProof] = useState<AllocationProof | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isClaiming, setIsClaiming] = useState(false)

  const lifecycle = getLifecycleState(campaign)
  const isMerkleErc20 = campaign.settlement?.mode === 'MERKLE_ERC20'

  useEffect(() => {
    if (!isConnected || !address || !isMerkleErc20) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    fetch(`/api/campaigns/${campaign.id}/allocation/${address}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setProof)
      .catch(() => setProof(null))
      .finally(() => setIsLoading(false))
  }, [campaign.id, address, isConnected, isMerkleErc20])

  if (!isMerkleErc20) return null
  if (!isConnected || !address) return null
  // Only show once claims are actually possible, or once claimed/swept (to explain state).
  if (!['claims_open', 'closed_claimable', 'swept'].includes(lifecycle.state)) return null
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
            This wallet has no allocation in this campaign
            {address ? ` — you participated with ${address}.` : '.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleClaim = async () => {
    setIsClaiming(true)
    try {
      await claimERC20Reward(campaign.id, proof.amount, proof.proof)
      toast({ title: 'Reward claimed!', description: 'Your tokens have been sent to your wallet.' })
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
          Allocation: {formatAmount(proof.amount, proof.decimals, proof.symbol)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {proof.status === 'claimed' ? (
          <div className="flex items-center gap-2 text-sm text-status-claimable-fg">
            <CheckCircle2 className="h-4 w-4" /> Already claimed.
          </div>
        ) : proof.status === 'swept' ? (
          <p className="text-sm text-muted-foreground">
            Unclaimed rewards for this campaign have been swept back to the host.
            Claiming is closed.
          </p>
        ) : proof.status === 'claimable' ? (
          <SponsoredClaimActions
            campaignId={campaign.id}
            account={address}
            busy={isClaiming}
            onSelfClaim={handleClaim}
            onSponsoredConfirmed={() => setProof({ ...proof, status: 'claimed' })}
            selfClaimLabel={`Claim ${formatAmount(proof.amount, proof.decimals, proof.symbol)}`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Your allocation isn't claimable yet — see the status above.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
