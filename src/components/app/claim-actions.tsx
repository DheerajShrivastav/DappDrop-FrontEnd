'use client'

import type { SponsoredClaimState } from '@/hooks/use-sponsored-claim'
import { appFlags } from '@/config/app'
import { network } from '@/config/landing'
import { Button } from './button'
import { InlineError } from './field'

export type WalletClaimPhase = 'idle' | 'confirm' | 'sending'

/**
 * The claim buttons (app-design §1.9; founder decision: gas-free is the primary claim, offered
 * to every wallet with a reward, never gated on Humanity). Presentational: the claim panel
 * (phase 2) owns the data and passes in `useSponsoredClaim()`'s state and its own wallet-claim
 * phase.
 *
 * - Gas-free available (the flag is on, and no request has failed): [Claim 250 EXAMPLE, gas-free]
 *   (gold) + [Claim with my wallet] (outline). The wallet claim stays live while a gas-free claim
 *   is in flight, so there's always a way out.
 * - Gas-free off (`appFlags.sponsoredClaims`, NEXT_PUBLIC_SPONSORED_CLAIMS=off) or failed
 *   (`sponsored.phase === 'unavailable'`): the fallback is automatic. [Claim 250 EXAMPLE with my
 *   wallet] becomes the gold primary; after a failure the reason is shown with [Try gas-free again].
 * - `disabledReason` (e.g. inside the 24-hour review): both buttons are disabled with the reason
 *   in words.
 * - `walletError`: a failed wallet transaction, in the one red.
 */
export function ClaimActions({
  amountLabel,
  sponsored = { phase: 'idle' },
  sponsoredEnabled = appFlags.sponsoredClaims,
  onSponsoredClaim,
  onRetrySponsored,
  onWalletClaim,
  walletPhase = 'idle',
  walletError,
  disabledReason,
}: {
  /** "250 EXAMPLE": goes into the button labels. */
  amountLabel: string
  sponsored?: SponsoredClaimState
  sponsoredEnabled?: boolean
  onSponsoredClaim?: () => void
  /** Reset the gas-free state (useSponsoredClaim's `reset`) so the gas-free button returns. */
  onRetrySponsored?: () => void
  onWalletClaim: () => void
  walletPhase?: WalletClaimPhase
  walletError?: string | null
  disabledReason?: string
}) {
  const gasFree = sponsoredEnabled && sponsored.phase !== 'unavailable' && Boolean(onSponsoredClaim)
  const gasFreeBusy = sponsored.phase === 'requesting' || sponsored.phase === 'processing'
  const walletBusy = walletPhase !== 'idle'
  const blocked = Boolean(disabledReason)

  if (sponsored.phase === 'confirmed') {
    return (
      <p role="status" className="flex items-baseline gap-2 text-body text-ink">
        <span aria-hidden="true" className="font-mono text-signal">
          ✓
        </span>
        Claimed for you, with no gas. {amountLabel} is in your wallet.
      </p>
    )
  }

  const walletLabel =
    walletPhase === 'confirm' ? 'Confirm in your wallet…' : walletPhase === 'sending' ? 'Sending…' : gasFree ? 'Claim with my wallet' : `Claim ${amountLabel} with my wallet`

  return (
    <div className="grid gap-3" data-claim-actions={gasFree ? 'gas-free' : 'wallet'}>
      <div className="flex flex-wrap gap-3 max-sm:[&>*]:w-full">
        {gasFree && (
          <Button variant="reward" onClick={onSponsoredClaim} loading={gasFreeBusy} disabled={blocked || walletBusy} className="max-sm:w-full">
            {sponsored.phase === 'requesting' ? 'Requesting…' : sponsored.phase === 'processing' ? 'Claiming for you…' : `Claim ${amountLabel}, gas-free`}
          </Button>
        )}
        <Button variant={gasFree ? 'secondary' : 'reward'} onClick={onWalletClaim} loading={walletBusy} disabled={blocked} className="max-sm:w-full">
          {walletLabel}
        </Button>
      </div>

      {blocked && <p className="text-small text-ink-2">{disabledReason}</p>}

      <p role="status" className="text-small text-ink-2 empty:hidden">
        {sponsored.phase === 'requesting' && 'Requesting a gas-free claim…'}
        {sponsored.phase === 'processing' && 'Claiming for you. This can take a couple of minutes. You can also claim with your wallet now.'}
      </p>

      {sponsoredEnabled && sponsored.phase === 'unavailable' && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-small text-ink-2">
          <p>
            Gas-free claiming isn&apos;t available right now: {sponsored.reason.replace(/\.?\s*$/, '.')} Your reward is the same; claim with your wallet.
          </p>
          {onRetrySponsored && (
            <Button variant="ghost" size="sm" onClick={onRetrySponsored} className="h-11 px-0">
              Try gas-free again
            </Button>
          )}
        </div>
      )}

      {walletError && <InlineError>{walletError}</InlineError>}

      <p className="text-[0.8125rem] leading-relaxed text-ink-2">
        {sponsoredEnabled
          ? `Gas-free claiming is offered to every wallet with a reward, while the daily budget lasts. Claiming with your own wallet always works and costs a little ${network.gasToken}.`
          : `Claiming with your wallet costs a little ${network.gasToken} for gas.`}
      </p>
    </div>
  )
}
