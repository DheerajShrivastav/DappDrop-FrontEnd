import { claims } from '@/config/claims'
import { network, networkLabel } from '@/config/landing'
import { primaryButton } from './ui'
import { StatementSlip } from './statement-slip'

/**
 * S1-04: the hero (plan §2.1), a server component. The H1 is the LCP element: plain text,
 * never inside #slip, never animated, opacity 1 with JS off.
 *
 * - Secondary link order (RED-13 / CD-revisions §7 S9): founding hosts (C1) → "Talk to the
 *   founder (20 min)" (C2) → "See how payouts work ↓".
 * - Participant link (D-X1): on-page until /campaigns is curated (C11).
 */
export function Hero() {
  const secondary = claims.foundingHosts.open
    ? { label: 'Apply as a founding host', href: '/#founding', external: false }
    : claims.founderContact
      ? { label: 'Talk to the founder (20 min)', href: claims.founderContact.url, external: true }
      : { label: 'See how payouts work ↓', href: '/#payouts', external: false }

  const participant = claims.campaignsCurated
    ? { label: 'Here to earn? Browse campaigns →', href: '/campaigns' }
    : { label: 'Here to earn? See how claiming works ↓', href: '/#participants' }

  const helper = network.testnet
    ? `Runs on ${network.name} with test tokens · No platform fee during beta`
    : 'No platform fee during beta'

  return (
    <section aria-labelledby="hero-title" data-section="hero" className="lp-container pb-12 pt-8 lg:pb-16 lg:pt-16">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* Non-dismissible beta chip; the dot never pulses (TRS C47). */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rule-strong bg-surface px-2.5 py-1 font-mono text-eyebrow font-medium uppercase text-ink">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink" />
              Public beta · {networkLabel}
            </span>
            <span className="font-mono text-eyebrow uppercase text-ink-3">For Web3 projects</span>
          </p>

          <h1 id="hero-title" className="mt-5 max-w-[20ch] font-display text-display-xl font-normal text-ink max-[359px]:text-[2rem]">
            Quest campaigns with the reward locked in up front.
          </h1>

          <p className="mt-5 max-w-[38rem] text-lead text-ink-2">
            In DappDrop you fund the escrow before your campaign opens. Reward lists are public for 24 hours before
            claims open, and you can take back whatever isn&apos;t claimed.
          </p>

          <div className="mt-7">
            <a id="hero-cta" href="/#start" className={`${primaryButton} w-full sm:w-auto`} data-cta="hero_primary" data-loc="hero">
              Start a test campaign
            </a>
            <p className="mt-2.5 font-mono text-[0.75rem] leading-5 text-ink-3">{helper}</p>
          </div>

          <ul className="mt-6 flex flex-col gap-1 text-body">
            <li>
              {secondary.external ? (
                <a href={secondary.href} target="_blank" rel="noopener noreferrer" className="lp-link inline-flex min-h-11 items-center" data-cta="hero_secondary" data-loc="hero">
                  {secondary.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <a href={secondary.href} className="lp-link inline-flex min-h-11 items-center" data-cta="hero_secondary" data-loc="hero">
                  {secondary.label}
                </a>
              )}
            </li>
            <li>
              <a href={participant.href} className="lp-link inline-flex min-h-11 items-center text-ink-2" data-cta="hero_participant" data-loc="hero">
                {participant.label}
              </a>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-5 lg:pt-2">
          <StatementSlip />
        </div>
      </div>
    </section>
  )
}
