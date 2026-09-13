'use client'

import { useEffect } from 'react'
import { CheckCircle2, Fuel, Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSponsoredClaim } from '@/hooks/use-sponsored-claim'

/**
 * The claim call-to-action, shared by all three claim panels (ERC20 Merkle, tiered, NFT).
 *
 * Offers the GASLESS path first — that is the whole point of the relayer (BR-R*), and the
 * backend resolves which claim kind this campaign uses from its settlement mode, so this
 * component is settlement-agnostic.
 *
 * SELF-CLAIM IS ALWAYS RENDERED. Not "eventually", not "once sponsorship gives up" — the
 * button is on screen in every phase, including while a sponsored claim is still polling. An
 * earlier version early-returned a bare spinner during `requesting`/`processing`, which left a
 * user with no claim action at all for the whole polling window; with a relayer that isn't
 * running, that is the entire wait. Sponsorship is a convenience and must never become a way to
 * lose access to your own reward, so it never takes the only exit away.
 *
 * Kept as ONE component rather than repeated per panel so this behaviour and its copy can't
 * drift between settlement modes.
 */
export function SponsoredClaimActions({
  campaignId,
  account,
  busy,
  onSelfClaim,
  onSponsoredConfirmed,
  selfClaimLabel,
}: {
  campaignId: string
  account: string | null | undefined
  /** True while the parent's own self-claim wallet tx is in flight. */
  busy: boolean
  onSelfClaim: () => void
  /** Called once the relayer confirms on-chain, so the parent can flip to its claimed state. */
  onSponsoredConfirmed: () => void
  /** Amount-bearing label, e.g. "Claim 1.5 TOKEN". Always rendered somewhere so a panel whose
   * only display of the payout was this button can never lose it (the tiered panel's was). */
  selfClaimLabel: string
}) {
  const { state, request, reset } = useSponsoredClaim(campaignId, account)

  // Notify the parent AFTER commit, never during render — the parent flips its own claimed
  // state in response, and setting parent state mid-render is a React anti-pattern.
  const confirmed = state.phase === 'confirmed'
  useEffect(() => {
    if (confirmed) onSponsoredConfirmed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed])

  if (state.phase === 'confirmed') {
    return (
      <div className="flex items-center gap-2 text-sm text-status-claimable-fg">
        <CheckCircle2 className="h-4 w-4" />
        Claimed for you — no gas required.
        {state.txHash && <span className="font-mono text-xs opacity-70">{state.txHash.slice(0, 10)}…</span>}
      </div>
    )
  }

  const sponsoredInFlight = state.phase === 'requesting' || state.phase === 'processing'

  return (
    <div className="space-y-3">
      {sponsoredInFlight && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state.phase === 'requesting'
            ? 'Requesting a gasless claim…'
            : 'Claiming for you — this can take a couple of minutes.'}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {state.phase === 'idle' && (
          <Button onClick={request} disabled={busy || !account}>
            <Fuel className="mr-2 h-4 w-4" />
            {selfClaimLabel} — gas on us
          </Button>
        )}

        {/* Declines are frequently temporary (budget topped up, kill switch resumed, worker
            restarted), so this must not be a one-way door: without a retry the only way back to
            the gasless option is a full page reload. */}
        {state.phase === 'unavailable' && (
          <Button variant="outline" onClick={reset} disabled={busy}>
            <Fuel className="mr-2 h-4 w-4" />
            Try gasless again
          </Button>
        )}

        <Button
          variant={state.phase === 'idle' ? 'outline' : 'default'}
          onClick={onSelfClaim}
          disabled={busy}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
          {state.phase === 'idle' ? 'Claim myself' : selfClaimLabel}
        </Button>
      </div>

      {sponsoredInFlight && (
        <p className="text-xs text-muted-foreground">
          You don&apos;t have to wait — claiming yourself also works. If the sponsored claim
          lands first, your own transaction will simply fail as already claimed.
        </p>
      )}
      {state.phase === 'unavailable' && (
        <p className="text-xs text-muted-foreground">
          {state.reason} You&apos;ll pay the network fee yourself — your reward amount is
          unchanged.
        </p>
      )}
      {state.phase === 'idle' && (
        <p className="text-xs text-muted-foreground">
          Gasless claims are paid for by the platform when available. Claiming yourself always
          works and costs a small network fee.
        </p>
      )}
    </div>
  )
}
