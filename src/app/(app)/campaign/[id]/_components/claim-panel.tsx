'use client'

import { useEffect, useState } from 'react'
import { formatUnits } from 'ethers'
import { Loader2, Trophy, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useWallet } from '@/context/wallet-provider'
import type { Campaign } from '@/lib/types'
import { claimERC20Reward, mapContractRevertToMessage } from '@/lib/web3-service'
import { getLifecycleState } from '@/lib/campaign-lifecycle'

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

// Display-only — claimERC20Reward always submits proof.amount (raw base units) unchanged;
// this never feeds back into anything on-chain. Falls back to labeled raw units if the
// token's decimals couldn't be resolved, rather than guessing a possibly-wrong value.
function formatAmount(raw: string, decimals: number | null, symbol: string | null): string {
  if (decimals == null) return `${raw} (raw units — token decimals unavailable)`
  try {
    const formatted = formatUnits(raw, decimals)
    return symbol ? `${formatted} ${symbol}` : formatted
  } catch {
    return `${raw} (raw units)`
  }
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
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
          <Button onClick={handleClaim} disabled={isClaiming}>
            {isClaiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Claim {formatAmount(proof.amount, proof.decimals, proof.symbol)}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your allocation isn't claimable yet — see the status above.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
