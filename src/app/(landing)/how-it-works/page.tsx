import type { Metadata } from 'next'
import { networkLabel } from '@/config/landing'
import { StatementSlip } from '@/components/landing/statement-slip'
import { HowSteps } from '@/components/landing/how-steps'
import { Modes, Payouts, Rules } from '@/components/landing/payouts'
import { TaskMatrix } from '@/components/landing/task-matrix'
import { Participants } from '@/components/landing/participants'
import { Pricing } from '@/components/landing/pricing'
import { Faq } from '@/components/landing/faq'
import { StartPanel } from '@/components/landing/start-panel'
import { HashDetailsOpener } from '@/components/landing/hash-details-opener'
import { PageJsonLd } from '@/components/landing/page-json-ld'

// 07-wow IA §2: the mechanics, moved from the old homepage (no copy changes beyond the IA's link
// rewrites). Static server component, no wallet code. Order: hero (+ the example statement) →
// steps → payouts → modes → rules → tasks → participants → pricing (+ founding) → FAQ → start.
const TITLE = 'How DappDrop works: steps, payout rules and tasks'
const DESCRIPTION = `How a DappDrop campaign runs: fund the escrow, check tasks, publish the reward list (public for 24 hours), and claims to each wallet. Public beta on ${networkLabel}.`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/how-it-works' },
  openGraph: { type: 'website', siteName: 'DappDrop', title: TITLE, description: DESCRIPTION, url: '/how-it-works' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export default function HowItWorksPage() {
  return (
    <>
      <section aria-labelledby="hero-title" data-section="hero" className="lp-container pb-12 pt-10 md:pb-16 md:pt-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6 lg:pt-6">
            <p className="font-mono text-eyebrow font-medium uppercase text-ink-3">How it works</p>
            <h1 id="hero-title" className="mt-3 max-w-[18ch] font-display text-display-xl font-normal text-ink max-[359px]:text-[2rem]">
              How a campaign runs, start to finish.
            </h1>
            <p className="mt-5 max-w-[36rem] text-lead text-ink-2">
              Every rule your campaign runs on, in order. Rules the contract enforces link to the code.
            </p>
          </div>
          <div className="lg:col-span-6">
            <StatementSlip />
          </div>
        </div>
      </section>
      <HowSteps />
      <Payouts />
      <Modes />
      <Rules />
      <TaskMatrix />
      <Participants />
      <Pricing />
      <Faq />
      <StartPanel />
      <HashDetailsOpener />
      <PageJsonLd path="/how-it-works" name="How it works" description={DESCRIPTION} />
    </>
  )
}
