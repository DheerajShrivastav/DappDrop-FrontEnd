import type { Metadata } from 'next'
import { claims } from '@/config/claims'
import { copyrightHolder, network, networkLabel, repos } from '@/config/landing'
import { IntentPrefetch } from '@/components/landing/intent-prefetch'
import { START_HREF } from '@/components/landing/nav'
import { PageJsonLd } from '@/components/landing/page-json-ld'
import { pillButton } from '@/components/landing/ui'

// 08-site: /about in the Monolith design. Short and honest (fact sheet §1-§4; TRS rows cited in
// the 08-site handoff): what DappDrop is, why escrow first, what it doesn't do, who's building
// it. Every person/contact detail comes from src/config/landing.ts (never invented): the founder
// is named only when `founderPublic` (C2), the contact link only when `founderContact` (D5).
// Static server component, no wallet code.
const TITLE = 'About DappDrop: quest campaigns with the reward in escrow'
const DESCRIPTION = `What DappDrop is, why the reward goes into on-chain escrow first, and what it doesn’t do. Public beta on ${networkLabel}.`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: { type: 'website', siteName: 'DappDrop', title: TITLE, description: DESCRIPTION, url: '/about' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

function Block({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} data-section={id} className="scroll-mt-20 border-t border-rule">
      <div className="lp-container grid gap-6 py-14 md:py-20 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <p className="font-mono text-eyebrow font-medium uppercase text-ink-3">{eyebrow}</p>
          <h2 id={`${id}-title`} tabIndex={-1} className="mh-display mt-3 text-[clamp(1.75rem,1.4rem+1.2vw,2.5rem)] leading-[1.08] text-ink outline-none">
            {title}
          </h2>
        </div>
        <div className="max-w-[40rem] space-y-4 text-body text-ink-2 md:text-lead lg:col-span-7 lg:col-start-6 lg:pt-8">{children}</div>
      </div>
    </section>
  )
}

export default function AboutPage() {
  const modes = ['an equal split from a published list', 'by rank', ...(claims.tierModuleFixed ? ['by points'] : [])]
  const payouts = `Pay in a token${claims.nftCustodyFixed ? ' or NFTs' : ''}: ${modes.slice(0, -1).join(', ')} or ${modes[modes.length - 1]}${
    claims.nftCustodyFixed ? '; NFTs go one per qualifying wallet' : ''
  }.`
  return (
    <>
      <section aria-labelledby="hero-title" data-section="hero" className="lp-container pb-14 pt-12 md:pb-20 md:pt-20">
        <p className="font-mono text-eyebrow font-medium uppercase text-ink-3">About</p>
        <h1 id="hero-title" className="mh-display mt-4 max-w-[16ch] text-[clamp(2.5rem,1.6rem+3.6vw,4.75rem)] leading-[1.02] text-ink">
          Quest campaigns, settled on-chain.
        </h1>
        <p className="mt-6 max-w-[38rem] text-lead text-ink-2">
          DappDrop runs quest campaigns for Web3 projects. The host funds the reward into an on-chain escrow contract before the
          campaign opens, and the wallets that earn it claim it from there.
        </p>
      </section>

      <Block id="what" eyebrow="What it is" title="Pick the tasks. Pick the payout.">
        <p>
          A host picks the tasks (join Discord or Telegram, a verified-human check, follow on X), funds the reward and opens the
          campaign. {payouts}
        </p>
        <p>
          It&apos;s in public beta on {networkLabel}, with test tokens. No code, and no platform fee during the beta; you pay network
          gas.
        </p>
        <p>
          <a href="/how-it-works" className="lp-link">
            How a campaign runs, start to finish →
          </a>
        </p>
      </Block>

      <Block id="why" eyebrow="Why escrow first" title="Lock the reward in first.">
        <p>
          A promised reward is only as good as the project that promised it. In DappDrop, the host funds the escrow contract before
          the campaign opens. Your reward never sits in a DappDrop wallet. In an emergency, our admin key can pause the contract;
          while it&apos;s paused, nobody can move the rewards, including us.
        </p>
        <p>
          Reward lists are public for 24 hours before claims open, so your community can spot a mistake. Each reward is bound to
          the wallet that earned it. Claims stay open 30 days after the host closes the campaign; then the host can take back
          what&apos;s left.
        </p>
      </Block>

      <Block id="limits" eyebrow="What it doesn’t do" title="Said plainly.">
        <p>
          No tool stops every bot. Tasks we can&apos;t check, like follows on X, are labelled self-reported. DappDrop doesn&apos;t vet
          hosts during the beta, so never pay to take part unless you trust the project.
        </p>
        <p>
          <a href="/security" className="lp-link">
            What our keys can and can&apos;t do →
          </a>
        </p>
      </Block>

      <Block id="who" eyebrow="Who’s building it" title="Built in public.">
        <p>
          {claims.founderPublic ? `DappDrop is built by ${copyrightHolder}. ` : ''}The app and the contracts are public code on GitHub,
          and the changelog lists what&apos;s shipped.
        </p>
        <p className="flex flex-wrap gap-x-6 gap-y-2">
          <a href={repos.app} target="_blank" rel="noopener noreferrer" className="lp-link" data-dest="about_app_code">
            App code ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a href={repos.contracts} target="_blank" rel="noopener noreferrer" className="lp-link" data-dest="about_contracts_code">
            Contracts code ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a href="/changelog" className="lp-link">
            Changelog →
          </a>
        </p>
        <p>
          {claims.founderContact ? (
            <a href={claims.founderContact.url} target="_blank" rel="noopener noreferrer" className="lp-link" data-cta="talk_founder" data-loc="about">
              Talk to the founder ↗<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <a href={`${repos.app}/issues`} target="_blank" rel="noopener noreferrer" className="lp-link" data-dest="github_issues">
              Questions? Ask on GitHub ↗<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </p>
      </Block>

      <section aria-labelledby="about-start-title" data-section="about_start" className="border-t border-rule">
        <div className="lp-container flex flex-col items-start gap-6 py-16 md:flex-row md:items-center md:justify-between md:py-24">
          <h2 id="about-start-title" className="mh-display text-[clamp(1.75rem,1.4rem+1.2vw,2.5rem)] leading-[1.08] text-ink">
            {network.testnet ? 'Try it with test tokens.' : 'Start a campaign.'}
          </h2>
          <IntentPrefetch href={START_HREF} className={pillButton} cta="about_start" loc="about">
            {network.testnet ? 'Start a test campaign' : 'Start a campaign'}
          </IntentPrefetch>
        </div>
      </section>
      <PageJsonLd path="/about" name="About" description={DESCRIPTION} />
    </>
  )
}
