import { claims } from '@/config/claims'
import { explorerCodeUrl, network, repos } from '@/config/landing'
import { MoneyDiagram } from './money-diagram'
import { PayoutModes } from './payout-modes'
import { Receipt } from './receipt'
import { RuleRibbon } from './rule-ribbon'
import { Section } from './section'
import { primaryButton } from './ui'

/**
 * S1-08: #payouts, the signature section (plan §2.3; CD-revisions §2.3; TRS F09–F28).
 * Flag paths: escrowBalanceOnCampaignPage (V1 wording, RED-23), plus those in PayoutModes and
 * RuleRibbon. "Read the payout rules" points at REWARD_SYSTEM.md at the deployed tag, else the
 * verified source (F27, D-X11: never at undeployed code).
 */
export function Payouts() {
  const rulesHref = claims.deployedTag
    ? `${repos.contracts}/blob/${claims.deployedTag}/docs/REWARD_SYSTEM.md`
    : explorerCodeUrl(network.entrypoint)
  const rulesWhere = claims.deployedTag ? `at ${claims.deployedTag} on GitHub` : `the verified contract source on ${network.explorerName}`

  return (
    <Section
      id="payouts"
      track="payouts"
      eyebrow="01 — How the money moves"
      title="Ask where the reward sits."
      dek="Ask before your campaign starts, before your community does a single task. Here, the answer is a contract you can read."
      after={
        <>
          <RuleRibbon />
          <div className="lp-container flex flex-col gap-4 pb-[var(--section-y)] pt-10 sm:flex-row sm:items-center">
            <a href="#start" className={primaryButton} data-cta="payouts_primary" data-loc="payouts">
              Start a test campaign
            </a>
            {rulesHref && (
              <a href={rulesHref} target="_blank" rel="noopener noreferrer" className="lp-link inline-flex min-h-11 items-center" data-dest="read_contracts">
                Read the payout rules ↗<span className="sr-only">: {rulesWhere} (opens in a new tab)</span>
              </a>
            )}
          </div>
        </>
      }
    >
      <div className="mt-8 grid items-center gap-6 lg:mt-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-6">
          <h3 className="text-title font-semibold">Where your tokens sit</h3>
          <p className="mt-3 text-small text-ink-2 md:text-body">
            Your reward never sits in a DappDrop wallet. In an emergency, our admin key can pause the contract; while it&apos;s
            paused, nobody can move the rewards, including us. Timers keep running during a pause.{' '}
            <a href="#can-cant" className="lp-link text-ink">
              See what our keys can do ↓
            </a>
          </p>
          <p className="mt-3 text-small text-ink-2 md:text-body">
            In DappDrop you fund the escrow before your campaign opens.{' '}
            {claims.escrowBalanceOnCampaignPage
              ? 'Anyone can check the escrowed balance on-chain before taking part.'
              : 'Each campaign’s escrowed amount can be read from the contract by campaign ID.'}{' '}
            <Receipt id="escrowRead" />
          </p>
        </div>
        <div className="lg:col-span-6">
          <MoneyDiagram />
        </div>
      </div>
      <PayoutModes />
    </Section>
  )
}
