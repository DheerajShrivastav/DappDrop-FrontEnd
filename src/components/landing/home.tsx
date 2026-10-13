import { claims } from '@/config/claims'
import { explorerCodeUrl, network, networkLabel } from '@/config/landing'
import { IntentPrefetch } from './intent-prefetch'
import { START_HREF } from './nav'
import { pillButton } from './ui'
import { VaultPause } from './vault-pause'

/**
 * 07-wow: the Monolith homepage sections (copy: landing-studio/07-wow/copy/homepage-copy.md,
 * Monolith column; layout: prototypes/c1.html). Server components; 224 words in <main>.
 *
 * - The H1 is the LCP element: server-rendered, static, never animated or split.
 * - Beats carry id + data-beat (hero/fund/prove/claim/after) for the 3D scene's ScrollTrigger
 *   (build contract §3); data-section feeds section_view.
 * - Every status-dependent line reads src/config/claims.ts (copy §7 fallbacks).
 */
const startLabel = network.testnet ? 'Start a test campaign' : 'Start a campaign'

function Eyebrow({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="mh-eyebrow mb-4 text-ink-3 md:mb-6">
      <span aria-hidden="true" className="mr-2.5 text-signal">
        {n}
      </span>
      {children}
    </p>
  )
}

export function HomeHero() {
  const guarded = claims.hostCloseGuarded
  const secondary = claims.foundingHosts.open
    ? { label: 'Apply as a founding host', href: '/how-it-works#founding', external: false }
    : claims.founderContact
      ? { label: 'Talk to the founder (20 min)', href: claims.founderContact.url, external: true }
      : { label: 'See how it works', href: '/how-it-works', external: false }

  return (
    <section id="top" data-beat="hero" data-section="hero" aria-labelledby="hero-title" className="mh-hero lp-container">
      <div className="max-w-[33rem]">
        {/* Beta chip: the only beta signal above the fold; the dot never pulses (TRS C47). */}
        <a
          href="/how-it-works#faq-beta"
          className="mh-eyebrow mh-pill mb-4 inline-flex items-center gap-2.5 max-[359px]:text-[0.6875rem] max-[359px]:tracking-[0.06em] border border-rule-strong px-3 py-2 text-ink-2 no-underline can-hover:hover:text-ink md:mb-8"
          data-cta="beta_chip"
          data-loc="hero"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
          Public beta · {networkLabel}
          <span className="sr-only">: what this means</span>
        </a>

        <h1 id="hero-title" className="mh-display mh-h1 mb-4 text-ink md:mb-7">
          {guarded ? 'Don’t promise rewards. Lock them in.' : 'Quest campaigns, settled on-chain.'}
        </h1>

        <p className="mh-sub mb-5 text-ink-2 md:mb-9">
          {guarded
            ? 'Fund your quest campaign’s reward into on-chain escrow before it opens. Whoever earns it claims it from there.'
            : 'Fund the reward into on-chain escrow before your campaign opens. Whoever earns it claims it from there.'}
        </p>

        <div className="flex items-center gap-x-3 min-[380px]:gap-x-4 sm:gap-x-6">
          <IntentPrefetch id="hero-cta" href={START_HREF} className={`${pillButton} shrink-0 max-sm:px-5`} cta="hero_primary" loc="hero">
            {startLabel}
          </IntentPrefetch>
          {secondary.external ? (
            <a href={secondary.href} target="_blank" rel="noopener noreferrer" className="mh-textlink whitespace-nowrap text-small max-[359px]:hidden sm:text-body" data-cta="hero_secondary" data-loc="hero">
              {secondary.label} <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <a href={secondary.href} className="mh-textlink whitespace-nowrap text-small max-[359px]:hidden sm:text-body" data-cta="hero_secondary" data-loc="hero">
              {secondary.label} <span aria-hidden="true">→</span>
            </a>
          )}
          <VaultPause />
        </div>
      </div>
      <p aria-hidden="true" className="mh-cue mh-eyebrow text-[0.6875rem] tracking-[0.2em] text-ink-3">
        Scroll
      </p>
    </section>
  )
}

function Beat({
  id,
  n,
  label,
  title,
  top = false,
  children,
}: {
  id: 'fund' | 'prove' | 'claim'
  n: string
  label: string
  title: string
  top?: boolean
  children: React.ReactNode
}) {
  return (
    <section id={id} data-beat={id} data-section={id} aria-labelledby={`${id}-title`} className={`mh-beat ${top ? 'mh-beat--top' : ''}`}>
      <div className="mh-pin lp-container">
        <div className="mh-copy mh-reveal">
          <Eyebrow n={n}>{label}</Eyebrow>
          <h2 id={`${id}-title`} tabIndex={-1} className="mh-display mh-h2 mb-4 text-ink outline-none md:mb-5">
            {title}
          </h2>
          {children}
        </div>
      </div>
    </section>
  )
}

export function HomeBeats() {
  const source = explorerCodeUrl(network.entrypoint)
  const participant = claims.campaignsCurated
    ? { label: 'Here to earn? Browse campaigns', href: '/campaigns' }
    : { label: 'Here to earn? How claiming works', href: '/how-it-works#participants' }
  const body = 'max-w-[34ch] text-body text-ink-2 md:text-[1.125rem] md:leading-[1.55]'

  return (
    <>
      <Beat id="fund" n="01" label="Fund" title="The reward goes in first.">
        <p className={body}>
          Before your campaign opens, you fund an on-chain escrow contract.{' '}
          {claims.escrowBalanceOnCampaignPage
            ? 'Anyone can check the escrowed balance on-chain before taking part.'
            : 'The reward stays there until it’s claimed or you take it back.'}
        </p>
        {source && (
          <a href={source} target="_blank" rel="noopener noreferrer" className="mh-textlink mt-4 inline-block text-small text-ink-2 md:mt-6" data-dest="explorer_escrow">
            Read the contract <span aria-hidden="true">↗</span>
            <span className="sr-only">: the escrow contract&apos;s verified source on {network.explorerName} (opens in a new tab)</span>
          </a>
        )}
      </Beat>

      <Beat id="prove" n="02" label="Prove" title="24 hours to check the list.">
        <p className={body}>
          {claims.tasksEnforcedOnChain && 'Every task says how it’s checked. '}Your community can spot a mistake, and you can fix it,
          before any money moves.
        </p>
      </Beat>

      <Beat id="claim" n="03" label="Claim" title="Claimed straight to their wallets." top>
        <p className={body}>
          Each reward is bound to the wallet that earned it. Claims stay open 30 days after you close; then you can reclaim what&apos;s
          left.
        </p>
        <a href={participant.href} className="mh-textlink mt-4 inline-block text-small text-ink-2 md:mt-6" data-cta="claim_participant" data-loc="claim">
          {participant.label} <span aria-hidden="true">→</span>
        </a>
      </Beat>
    </>
  )
}

function ChipGroup({ id, label, dashed = false, chips }: { id: string; label: string; dashed?: boolean; chips: string[] }) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2.5 sm:flex-row sm:items-baseline sm:gap-5">
      <p id={id} className="mh-eyebrow w-32 shrink-0 text-ink-3">
        {label}
      </p>
      <ul className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <li key={c} className={`mh-chip ${dashed ? 'mh-chip--dashed' : ''}`}>
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Tasks and payouts, shown as real-text chips (copy §2.5). Static grid, no motion. */
export function HomeModes() {
  const checked = [...(claims.tasksEnforcedOnChain ? ['Join Discord', 'Join Telegram'] : []), 'Verified human', 'Connect wallet']
  const payouts = ['Equal split', 'By rank', ...(claims.tierModuleFixed ? ['By points'] : []), ...(claims.nftCustodyFixed ? ['NFTs'] : [])]
  return (
    <section id="modes" data-beat="after" data-section="modes" aria-labelledby="modes-title" className="mh-after-first">
      <div className="lp-container pb-16 pt-12 md:pb-24 md:pt-40">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <h2 id="modes-title" tabIndex={-1} className="mh-display mh-h2 text-ink outline-none">
              Pick the tasks. Pick the payout.
            </h2>
            <p className="mt-5 max-w-[34ch] text-body text-ink-2 md:text-[1.125rem] md:leading-[1.55]">
              {claims.tierModuleFixed ? 'Rank and points payouts need no list: the contract computes them.' : 'Rank payouts need no list: the contract computes them.'}
              {claims.nftCustodyFixed && ' NFTs go one per qualifying wallet.'}
            </p>
          </div>
          <div className="flex flex-col gap-6 lg:col-span-7 lg:pt-3">
            <ChipGroup id="chips-checked" label="Checked" chips={checked} />
            <ChipGroup id="chips-self" label="Self-reported" dashed chips={['Follow on X']} />
            <ChipGroup id="chips-payouts" label="Payouts" chips={payouts} />
            <p>
              <a href="/how-it-works#modes" className="mh-textlink text-small" data-cta="modes_more" data-loc="modes">
                How payouts work <span aria-hidden="true">→</span>
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/** The trust line: one line, one link (copy §2.6). Below 400 px it drops to the short form. */
export function HomeTrust() {
  const item = 'whitespace-nowrap'
  const sep = <span aria-hidden="true" className="mx-2 text-ink-3">·</span>
  return (
    <section id="trust" data-beat="after" data-section="trust" aria-label="Trust" className="mh-after">
      <div className="lp-container">
        <p className="flex flex-wrap items-baseline gap-y-2 border-y border-rule py-6 text-small text-ink-2 md:text-body">
          <span className="max-[399px]:hidden">
            <span className={item}>Contracts verified on {network.explorerName}</span>
            {sep}
          </span>
          <span className={item}>{claims.licenseFile ? 'Open source (MIT)' : 'Public code'}</span>
          {sep}
          <span className="max-[399px]:hidden">
            <span className={item}>Built on OpenZeppelin</span>
            {sep}
          </span>
          <span className={item}>Not audited yet</span>
          <span className="ml-auto pl-4">
            <a href="/security" className="mh-textlink whitespace-nowrap text-ink" data-cta="trust_security" data-loc="trust">
              Check our work <span aria-hidden="true">→</span>
            </a>
          </span>
        </p>
      </div>
    </section>
  )
}

export function HomeFinal() {
  return (
    <section id="final" data-beat="after" data-section="final" aria-labelledby="final-title" className="mh-after">
      <div className="lp-container flex flex-col items-center py-24 text-center md:py-36">
        <h2 id="final-title" tabIndex={-1} className="mh-display mh-h2 text-ink outline-none">
          {claims.hostCloseGuarded ? 'Lock in your first reward.' : 'Try it with test tokens.'}
        </h2>
        <p className="mt-5 max-w-[36ch] text-body text-ink-2 md:text-[1.125rem] md:leading-[1.55]">
          {network.testnet && `Runs on ${network.name} with test tokens. `}No code, and no platform fee during beta; you pay network gas.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <IntentPrefetch href={START_HREF} className={pillButton} cta="final_primary" loc="final">
            {startLabel}
          </IntentPrefetch>
          <a href="/how-it-works#start" className="mh-textlink text-body" data-cta="final_needs" data-loc="final">
            What you&apos;ll need <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}

/**
 * IA §1.11: old homepage anchors (shared or bookmarked) now live on the subpages. Hashes never
 * reach the server, so this inline script maps them before paint (≈0.3 KB, no React).
 */
export const OLD_HASH_REDIRECT = `(function(){var h=location.hash.slice(1),m={payouts:'/how-it-works#payouts',how:'/how-it-works#steps',verification:'/how-it-works#tasks',rules:'/how-it-works#rules',participants:'/how-it-works#participants',pricing:'/how-it-works#pricing',founding:'/how-it-works#founding',faq:'/how-it-works#faq',start:'/how-it-works#start',security:'/security','can-cant':'/security#can-cant'},u=m[h]||(/^(faq-[a-z]+|rule-r[1-7])$/.test(h)?'/how-it-works#'+h:'');if(u)location.replace(u)})()`
