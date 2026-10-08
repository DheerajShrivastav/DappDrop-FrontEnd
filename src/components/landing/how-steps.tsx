import { BuildReplica, FundReplica, RunReplica, SettleReplica } from './replicas'
import { Section } from './section'
import { StepSwap } from './step-swap'
import { primaryButton } from './ui'

/**
 * S1-10: #how (plan §2.4; F47/F48). Four steps, each an <h3> + paragraph that carries the full
 * meaning. Phone, short screens and reduced motion: stacked cards, each with its replica.
 * Desktop ≥ 1024 × 700: one sticky panel cross-fades between the replicas (StepSwap, ≈1 KB);
 * the panel is aria-hidden. Never "real-time" (§5).
 */
const STEPS = [
  {
    n: '1',
    title: 'Build',
    body: 'Four guided steps: details, tasks, rewards, review. Stuck on wording? Let AI draft the title, description and tasks from a short description of your project. Skip it if you’d rather write your own.',
    Replica: BuildReplica,
  },
  {
    n: '2',
    title: 'Fund',
    body: 'Deposit your token or NFTs into the escrow. You see an itemised funding breakdown and the exact transactions you’ll sign before you sign them. If a step fails, the flow picks up where it stopped.',
    Replica: FundReplica,
  },
  {
    n: '3',
    title: 'Run',
    body: 'Share your campaign. Participants complete tasks with their wallet, and your dashboard shows the participant funnel and campaign analytics.',
    Replica: RunReplica,
  },
  {
    n: '4',
    title: 'Settle',
    body: 'The campaign ends on schedule. The reward list is public for 24 hours, then claims open. Once you close the campaign, participants have 30 more days; after that, you can take back whatever’s left.',
    Replica: SettleReplica,
  },
] as const

export function HowSteps() {
  return (
    <Section
      id="how"
      track="how"
      eyebrow="02 — How it works"
      title="Build it, fund it, run it, settle it."
      dek="Four steps in one guided flow. No code, and you see every transaction before you sign."
    >
      <div className="lp-how mt-8 lg:mt-10 lg:grid lg:grid-cols-12 lg:gap-12">
        <ol className="space-y-6 lg:col-span-5 lg:space-y-0">
          {STEPS.map(({ n, title, body, Replica }) => (
            <li key={n} className="lp-how-step lg:flex lg:min-h-[60vh] lg:flex-col lg:justify-center" data-step={n}>
              <h3 className="flex items-baseline gap-3 text-title font-semibold">
                <span className="font-mono text-[0.875rem] font-medium text-ink-3">0{n}</span>
                {title}
              </h3>
              <p className="mt-2 text-small text-ink-2 md:text-body">
                {body}
                {n === '4' && (
                  <>
                    {' '}
                    <a href="#rules" className="lp-link text-ink">
                      See the money rules ↑
                    </a>
                  </>
                )}
              </p>
              {/* Phone: only the Fund replica (the funding breakdown and the transactions you'll
                  sign) stays inline, for the page-height budget; desktop shows all four. */}
              <div className={`lp-how-inline mt-4 ${n === '2' ? '' : 'hidden'}`}>
                <Replica />
              </div>
            </li>
          ))}
        </ol>
        <div className="lp-how-panel hidden lg:col-span-7 lg:block" aria-hidden="true">
          <div className="sticky top-28">
            <div className="relative">
              {STEPS.map(({ n, Replica }, i) => (
                <div key={n} className={`lp-how-slide ${i === 0 ? 'is-active' : ''}`} data-slide={n}>
                  <Replica />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <StepSwap />
      <div className="mt-8 lg:mt-10">
        <a href="#start" className={primaryButton} data-cta="how_primary" data-loc="how">
          Start a test campaign
        </a>
      </div>
    </Section>
  )
}
