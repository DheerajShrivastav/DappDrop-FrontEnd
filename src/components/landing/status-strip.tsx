import { claims } from '@/config/claims'
import { network, networkLabel } from '@/config/landing'

/**
 * S1-03: the beta status strip (plan §2.0). Above the header, ≤ 32 px, scrolls away, and has no
 * dismiss (the strip, the header label and the hero chip carry the beta state together).
 * Copy reads from claims.ts (e2eClaimConfirmed, F01/F02) and the network from the app config.
 */
export function StatusStrip() {
  const run = claims.e2eClaimConfirmed
    ? 'Run a full campaign with test tokens, from funding to claims.'
    : network.testnet
      ? `Run a full test campaign on ${network.name}.`
      : null

  return (
    <div className="border-b border-rule bg-sunk text-ink">
      <div className="lp-container flex min-h-8 items-center justify-center py-1.5 text-center text-[0.8125rem] leading-5">
        {/* Phone: one line at 320 px. */}
        <p className="md:hidden">
          Beta on {networkLabel} · No platform fee ·{' '}
          <a href="/#faq-beta" className="lp-link">
            Details<span className="sr-only"> about the beta</span>
          </a>
        </p>
        <p className="hidden md:block">
          <strong className="font-semibold">Public beta on {networkLabel}.</strong>
          {run && <> {run}</>} No platform fee during beta.{' '}
          <a href="/#faq-beta" className="lp-link">
            What this means<span aria-hidden="true"> →</span>
          </a>
        </p>
      </div>
    </div>
  )
}
