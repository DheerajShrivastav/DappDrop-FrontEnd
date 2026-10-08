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
      <div className="lp-container flex min-h-[31px] items-center justify-center py-[5px] text-center text-[0.8125rem] leading-5">
        {/* Phone: one line at 320 px. */}
        <p className="md:hidden">
          {/* The whole line is the link, so it fits one line at 320 px ("Details" shows from 360). */}
          <a href="/#faq-beta" className="lp-link">
            Beta on {networkLabel} · No platform fee
            <span className="sr-only min-[360px]:not-sr-only"> · Details</span>
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
