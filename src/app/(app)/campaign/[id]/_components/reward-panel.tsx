'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { shortDate, shortDateTime } from '@/lib/campaign-status'
import { network } from '@/config/landing'
import { useSponsoredClaim } from '@/hooks/use-sponsored-claim'
import { mapContractRevertToMessage } from '@/lib/web3-service'
import { Button, ClaimActions, ClaimSkeleton, Panel, shortAddress, toast, type WalletClaimPhase } from '@/components/app'

export type RewardAmount = { value: string; unit?: string }

/** Every state of the claim panel (§1.9). Containers (Merkle, NFT, tiered) map their data here. */
export type RewardViewState =
  | { kind: 'connect' }
  | { kind: 'checking' }
  | { kind: 'waiting-list'; tasksDone: boolean }
  | { kind: 'not-on-list' }
  | { kind: 'not-eligible'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'review'; amount: RewardAmount; claimsOpenAt?: Date }
  | { kind: 'claimable'; amount: RewardAmount }
  | { kind: 'claimed'; amount?: RewardAmount; txHash?: string | null }
  | { kind: 'swept'; endedOn?: Date }

/** "250.0 EXAMPLE" → { value: "250", unit: "EXAMPLE" }; anything else stays whole. */
export function splitAmount(label: string): RewardAmount {
  const m = label.match(/^([\d.]+)\s+(.+)$/)
  if (!m) return { value: label }
  const [int, frac] = m[1].split('.')
  const trimmed = frac && /[1-9]/.test(frac) ? `.${frac.replace(/0+$/, '')}` : ''
  return { value: `${Number(int).toLocaleString('en-US')}${trimmed}`, unit: m[2] }
}

export const amountText = (a: RewardAmount) => (a.unit ? `${a.value} ${a.unit}` : a.value)

/**
 * The claim panel (§1.9): the first block in the main column whenever this wallet has something
 * to claim or is waiting for one. "Your reward" → the amount in serif gold → what it's bound to →
 * the claim buttons → the deadline line. Presentational: the containers own the data.
 */
export function RewardPanel({
  view,
  address,
  nft = false,
  rankLine,
  actions,
  deadline,
  report,
  onConnect,
  onRetry,
}: {
  view: RewardViewState
  address?: string | null
  /** An NFT goes to the wallet, not "tokens". */
  nft?: boolean
  /** Tiered: "Completion rank #3" / "Score: 40 points". */
  rankLine?: string
  /** <ClaimButtons/> (claimable, and disabled inside the 24-hour review). */
  actions?: ReactNode
  /** The deadline line, e.g. "No deadline yet. …" / "Claim by 15 Nov. …". */
  deadline?: ReactNode
  /** The "Report a concern" trigger. */
  report?: ReactNode
  onConnect?: () => void
  onRetry?: () => void
}) {
  if (view.kind === 'checking') {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Checking your reward…</span>
        <ClaimSkeleton />
      </div>
    )
  }

  const amount = 'amount' in view ? view.amount : undefined

  return (
    <Panel as="section" tone="strong" pad={false} className="p-5 md:p-7" aria-labelledby="cp-reward" data-reward-state={view.kind}>
      <h2 id="cp-reward" className="dd-eyebrow">
        Your reward
      </h2>

      {amount && (
        <p className="cp-amount">
          {amount.value}
          {amount.unit && <small>{amount.unit}</small>}
        </p>
      )}
      {rankLine && <p className="mt-3 font-mono text-[0.8125rem] text-ink-2">{rankLine}</p>}

      {(view.kind === 'claimable' || view.kind === 'review') && address && (
        <p className="mt-4 max-w-[52ch] text-small text-ink-2">
          Bound to your wallet{' '}
          <span className="font-mono text-ink" title={address}>
            {shortAddress(address)}
          </span>
          . Whoever sends the claim, {nft ? 'the NFT' : 'the tokens'} can only go there.
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {view.kind === 'connect' && (
          <>
            <p className="text-body text-ink">Connect your wallet to see if you have a reward.</p>
            <div>
              <Button onClick={onConnect}>Connect wallet</Button>
            </div>
          </>
        )}

        {view.kind === 'waiting-list' && (
          <p className="max-w-[60ch] text-body text-ink">
            {view.tasksDone
              ? 'Your tasks are done. The host publishes the reward list next; we’ll show your reward here.'
              : 'The host publishes the reward list next. A wallet is on it only if it finished every required task.'}
          </p>
        )}

        {view.kind === 'not-on-list' && (
          <>
            <p className="max-w-[60ch] text-body text-ink">
              This wallet isn’t on the reward list. A wallet is on it only if it finished every required task.
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button asChild variant="secondary" size="sm">
                <a href="#cp-list">View the list</a>
              </Button>
              {report && (
                <span className="text-small text-ink-2">
                  Something wrong? {report}
                </span>
              )}
            </div>
          </>
        )}

        {view.kind === 'not-eligible' && <p className="max-w-[60ch] text-body text-ink">{view.message}</p>}

        {view.kind === 'error' && (
          <div role="alert" className="grid justify-items-start gap-3">
            <p className="max-w-[60ch] text-body text-ink">
              <span aria-hidden="true" className="mr-2 font-mono font-semibold text-danger">
                !
              </span>
              {view.message}
            </p>
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        )}

        {(view.kind === 'claimable' || view.kind === 'review') && actions}

        {view.kind === 'claimed' && (
          <p role="status" className="flex flex-wrap items-baseline gap-x-2 text-body text-ink">
            <span aria-hidden="true" className="font-mono text-signal">
              ✓
            </span>
            <span>
              Claimed.{amount ? ` ${amountText(amount)} is in your wallet.` : ' It’s in your wallet.'}
            </span>
            {view.txHash && network.explorer && (
              <a className="dd-link text-small" href={`${network.explorer}/tx/${view.txHash}`} target="_blank" rel="noopener noreferrer">
                View on Etherscan ↗
              </a>
            )}
          </p>
        )}

        {view.kind === 'swept' && (
          <p className="max-w-[60ch] text-body text-ink">
            {view.endedOn ? `The 30-day claim window ended on ${shortDate(view.endedOn)}, and` : 'The 30-day claim window ended, and'} the host took back the unclaimed
            rewards.
          </p>
        )}
      </div>

      {deadline && (view.kind === 'claimable' || view.kind === 'review') && (
        <p className="mt-5 border-t border-rule pt-4 text-[0.8125rem] text-ink-2">{deadline}</p>
      )}
    </Panel>
  )
}

/** "Claims open 17 Oct, 14:00 (in 6 hours)." */
export function reviewReason(claimsOpenAt?: Date, now: Date = new Date()): string {
  if (!claimsOpenAt) return 'Claims open once the 24-hour review is over.'
  const rel = claimsOpenAt.getTime() > now.getTime() ? ` (in ${formatDistanceToNowStrict(claimsOpenAt)})` : ''
  return `Claims open ${shortDateTime(claimsOpenAt)}${rel}.`
}

/**
 * The claim buttons for a container: gas-free first (useSponsoredClaim → the relayer at
 * /api/sponsored-claims), with the wallet claim always live next to it and the automatic fallback
 * handled by <ClaimActions/>. A failed wallet claim is toasted (announced) and kept inline in red.
 * `onClaimed` flips the container to its claimed state (with the tx hash when we have one).
 */
export function ClaimButtons({
  campaignId,
  address,
  amountLabel,
  claim,
  onClaimed,
  disabledReason,
  successTitle = 'Reward claimed',
  successBody = 'It’s on its way to your wallet.',
}: {
  campaignId: string
  address: string | null | undefined
  amountLabel: string
  /** The wallet claim; resolves to the tx hash. */
  claim: () => Promise<string | undefined>
  onClaimed: (txHash: string | null) => void
  disabledReason?: string
  successTitle?: string
  successBody?: string
}) {
  const { state, request, reset } = useSponsoredClaim(campaignId, address)
  const [phase, setPhase] = useState<WalletClaimPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  // Notify the container AFTER commit (never during render) once the relayer confirms.
  const confirmed = state.phase === 'confirmed'
  const sponsoredTx = state.phase === 'confirmed' ? state.txHash : null
  useEffect(() => {
    if (confirmed) onClaimed(sponsoredTx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed])

  const walletClaim = async () => {
    setError(null)
    // web3-service resolves only after the wallet prompt AND the receipt, so the two phases
    // can't be told apart here; "Sending…" reads true for both.
    setPhase('sending')
    try {
      const tx = await claim()
      toast({ title: successTitle, description: successBody })
      onClaimed(tx ?? null)
    } catch (e) {
      const msg = mapContractRevertToMessage(e)
      setError(msg)
      toast({ variant: 'destructive', title: 'Claim failed', description: msg })
    } finally {
      setPhase('idle')
    }
  }

  return (
    <ClaimActions
      amountLabel={amountLabel}
      sponsored={state}
      onSponsoredClaim={request}
      onRetrySponsored={reset}
      onWalletClaim={walletClaim}
      walletPhase={phase}
      walletError={error}
      disabledReason={disabledReason}
    />
  )
}
