'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Sponsored (gasless) claim request + status polling — the client half of PRD BR-R*.
 *
 * The relayer backend (POST/GET /api/sponsored-claims, worker/relayer.ts) shipped in P2 CP1,
 * but nothing in the participant UI ever called it, so every claim button went straight to the
 * user's own wallet and asked them for gas. This hook is that missing entry point.
 *
 * Deliberate design points:
 * - Self-claim is ALWAYS the fallback and is never blocked. Every non-success outcome — declined
 *   by the gates, relayer failure, or simply taking too long — lands on `unavailable` with a
 *   reason to show, and the panel keeps its normal claim button. Sponsorship is a convenience;
 *   it must never become a way to lose access to your own reward.
 * - The kind (ERC20_MERKLE / TIERED / NFT) is resolved SERVER-side from the campaign's
 *   settlement mode, so callers pass nothing but campaignId + account.
 * - Polling is bounded. worker/relayer.ts is a separate process; if it isn't running, a claim
 *   sits at PENDING forever. Rather than spin indefinitely we give up after POLL_TIMEOUT_MS and
 *   route the user to self-claim — a stalled queue must not look like a hung button.
 */

const POLL_INTERVAL_MS = 3000

/**
 * How long we wait for the relayer before routing the user to self-claim.
 *
 * COUPLED TO THE WORKER'S TIMING — do not lower this in isolation. worker/relayer.ts is a
 * separate process, and the worst case before a claim can possibly be CONFIRMED is:
 *   RELAYER_INTERVAL_MINUTES (default 2 => 120s)  — how long a PENDING row waits to be
 *                                                    picked up by the next --loop cycle
 * + RELAYER_TX_TIMEOUT_MS    (default 120000ms)   — how long tx.wait() may then take
 *   ≈ 240s
 *
 * The old 90s bound sat below even the pickup interval, so the normal path timed out, told the
 * user to self-claim, and then the relayer confirmed anyway a minute later — the user's own
 * transaction reverted with "already claimed". 300s (5 min) clears the 240s worst case with room
 * to spare. If RELAYER_INTERVAL_MINUTES is raised, raise this too.
 *
 * Waiting longer is cheap: the UI shows a spinner for the whole `processing` phase, so the user
 * can see it is still working. This bound exists for a genuinely stalled or not-running worker,
 * not for normal relayer latency.
 */
const POLL_TIMEOUT_MS = 300_000

/** Server-side SponsoredClaim.status values that mean "still in flight". */
const IN_FLIGHT = ['PENDING', 'PROCESSING', 'SUBMITTED']

export type SponsoredClaimState =
  | { phase: 'idle' }
  | { phase: 'requesting' }
  | { phase: 'processing'; status: string }
  | { phase: 'confirmed'; txHash: string | null }
  /** Sponsorship isn't happening — show `reason` and fall back to self-claim. */
  | { phase: 'unavailable'; reason: string }

export function useSponsoredClaim(campaignId: string, account: string | null | undefined) {
  const [state, setState] = useState<SponsoredClaimState>({ phase: 'idle' })
  /**
   * Monotonic id of the newest poll run. `request()` captures the value it was started with and
   * the loop bails as soon as `runIdRef.current` moves past it.
   *
   * A plain boolean `cancelledRef` does NOT work here: on a campaignId/account change React runs
   * the effect cleanup (which would set it to `true`) and then immediately re-runs setup (setting
   * it back to `false`), so the already-in-flight loop reads `false` and keeps polling — and
   * keeps calling setState — for the *previous* wallet. Bumping an id instead can never be
   * undone by a later run, so both supersession (wallet/campaign switch) and unmount stop the
   * old loop for good.
   */
  const runIdRef = useRef(0)

  useEffect(() => {
    // Any loop started for the previous campaign/account is now stale; unmount supersedes too.
    return () => {
      runIdRef.current += 1
    }
  }, [campaignId, account])

  const reset = useCallback(() => setState({ phase: 'idle' }), [])

  const request = useCallback(async () => {
    if (!account) {
      setState({ phase: 'unavailable', reason: 'Connect your wallet to request a sponsored claim.' })
      return
    }
    // Claim this run: any earlier in-flight loop is superseded and will stop at its next check.
    const runId = ++runIdRef.current
    const superseded = () => runIdRef.current !== runId

    setState({ phase: 'requesting' })

    let enqueued: { status?: string; reason?: string; error?: string }
    try {
      const res = await fetch('/api/sponsored-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ campaignId: Number(campaignId), account }),
      })
      enqueued = await res.json()
      if (superseded()) return
      if (!res.ok && res.status !== 200 && res.status !== 202) {
        setState({
          phase: 'unavailable',
          reason: enqueued?.error || 'Could not request a sponsored claim.',
        })
        return
      }
    } catch {
      if (superseded()) return
      setState({ phase: 'unavailable', reason: 'Could not reach the sponsorship service.' })
      return
    }

    // A declined request is a normal outcome, not an error: the platform has chosen not to pay
    // gas for this claim (budget exhausted, wallet ineligible, kill switch, …).
    if (enqueued.status === 'DECLINED') {
      setState({
        phase: 'unavailable',
        reason: enqueued.reason || 'Sponsored claims are not available for this campaign.',
      })
      return
    }
    if (enqueued.status === 'CONFIRMED') {
      setState({ phase: 'confirmed', txHash: null })
      return
    }

    setState({ phase: 'processing', status: enqueued.status ?? 'PENDING' })

    const startedAt = Date.now()
    while (!superseded()) {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setState({
          phase: 'unavailable',
          reason:
            'The sponsored claim is taking longer than expected. You can claim it yourself instead — your reward is unaffected.',
        })
        return
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      if (superseded()) return

      try {
        const res = await fetch(
          `/api/sponsored-claims?campaignId=${encodeURIComponent(campaignId)}&account=${encodeURIComponent(account)}`,
          { credentials: 'include' },
        )
        // 401/403 can never resolve by waiting (session expired, or a wallet switch left this
        // loop asking about someone else's claim) — bail immediately rather than spinning out
        // the full timeout and then blaming a slow relayer for an auth problem.
        if (res.status === 401 || res.status === 403) {
          const body = await res.json().catch(() => ({}))
          setState({
            phase: 'unavailable',
            reason: body?.error || 'Your session expired. You can claim it yourself instead.',
          })
          return
        }
        if (!res.ok) continue // 404 => the row isn't visible yet; keep waiting out the timeout
        const data = await res.json()
        if (superseded()) return

        if (data.status === 'CONFIRMED') {
          setState({ phase: 'confirmed', txHash: data.txHash ?? null })
          return
        }
        if (data.status === 'DECLINED') {
          setState({
            phase: 'unavailable',
            reason: data.declineReason || 'Sponsored claims are not available for this campaign.',
          })
          return
        }
        if (data.status === 'FAILED') {
          setState({
            phase: 'unavailable',
            reason: data.lastError
              ? `The sponsored claim failed (${data.lastError}). You can claim it yourself instead.`
              : 'The sponsored claim failed. You can claim it yourself instead.',
          })
          return
        }
        if (IN_FLIGHT.includes(data.status)) {
          setState({ phase: 'processing', status: data.status })
        }
      } catch {
        // Transient network blip — keep polling until the timeout decides.
      }
    }
  }, [campaignId, account])

  return { state, request, reset }
}
