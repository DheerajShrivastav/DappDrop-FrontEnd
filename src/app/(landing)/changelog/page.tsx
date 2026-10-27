import type { Metadata } from 'next'
import { claims } from '@/config/claims'
import { networkLabel, repos } from '@/config/landing'
import { PageJsonLd } from '@/components/landing/page-json-ld'

// 08-site: /changelog as a clean, dated release log in the Monolith type (mono dates, a serif
// title per entry, short bullets). Entries are the previous changelog's, re-read against the fact
// sheet and the claims flags (the 08-site handoff lists every cut):
// - no hype ("revolutionary", "cutting-edge", "secure", "premium") and no outcome claims we can't
//   show ("prevents bot manipulation", "sybil resistant", "zero breaking changes");
// - Humanity Protocol is named only with `humanityNaming` (C12);
// - the payment task entry shows only with `paymentTaskChainLocked` (it's hidden on the landing
//   pages until payment tasks are locked to the deployment chain);
// - the Humanity developer-grant entry is held until the founder confirms it may be public.
// Static server component, no wallet code.
const TITLE = 'Changelog: what’s shipped in DappDrop'
const DESCRIPTION = `Dated releases of the DappDrop app and contracts, newest first. Public beta on ${networkLabel}.`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/changelog' },
  openGraph: { type: 'website', siteName: 'DappDrop', title: TITLE, description: DESCRIPTION, url: '/changelog' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

type Entry = { date: string; area: 'App' | 'Contracts' | 'Tasks' | 'AI'; title: string; items: string[]; show?: boolean }

const human = claims.humanityNaming ? 'Humanity Protocol' : 'our verified-human provider'
const humanSdk = claims.humanityNaming ? 'Humanity Protocol’s v2 OAuth SDK' : 'the provider’s v2 OAuth SDK'

// DRAFT, the contracts redeploy (contracts PRs #23-#26). Hidden until claims.contractsDeployedOn
// is set on redeploy day, and then dated by it. Each line is a fact about the redeployed contracts
// (contracts docs/SECURITY_FINDINGS.md) and renders only with the claims flag that asserts it, so
// it can't run ahead of the deployment. TRS should re-read the wording before it goes live.
const redeployItems = [
  claims.tasksEnforcedOnChain &&
    'A task is recorded as done only with our verifier’s signature, or by the contract’s own balance check for holding tasks. A wallet can no longer mark a task done on the contract by itself.',
  claims.tierModuleFixed && 'By-points rewards pay only wallets that finished every required task.',
  claims.tieredCancelLive && 'Ranked and by-points campaigns that nobody joined can be cancelled for an immediate refund.',
  claims.hostCloseGuarded &&
    'A host can’t close a campaign while its escrowed tokens or NFTs have no published reward list.',
  claims.nftCustodyFixed && 'An NFT held for one campaign can only leave through that campaign.',
  claims.feeCapEnforced && 'The contract caps any platform fee at 10% of the funding it receives.',
  claims.rolesSplit && 'The verifier and fallback-settler roles are held by wallets other than the admin’s.',
  'The app explains every contract error in plain words.',
].filter((x): x is string => typeof x === 'string')

const ENTRIES: Entry[] = [
  {
    date: claims.contractsDeployedOn ?? '',
    area: 'Contracts',
    title: 'Contract update: task checks, closing and NFT custody',
    items: redeployItems,
    show: claims.contractsDeployedOn !== null,
  },
  {
    date: '2026-05-05',
    area: 'Tasks',
    title: 'The verified-human check moves to OAuth',
    items: [`Sign-in for the check now uses ${humanSdk}, replacing the v1 API.`],
  },
  {
    date: '2026-04-22',
    area: 'AI',
    title: 'AI campaign drafting, rebuilt',
    items: [
      'Drafts come from a planner, generator and validator pipeline on Google Gemini, replacing Genkit.',
      'Each draft is checked against the campaign schema and retried with feedback when it fails.',
    ],
  },
  {
    date: '2025-12-01',
    area: 'App',
    title: 'A redesigned app',
    items: ['New layouts for the dashboard, campaign cards and the campaign page.', 'Responsive layouts across the app.'],
  },
  {
    date: '2025-11-29',
    area: 'Tasks',
    title: 'Payment tasks',
    items: ['A task that asks for an on-chain payment, checked by transaction hash, amount and recipient.'],
    show: claims.paymentTaskChainLocked,
  },
  {
    date: '2025-11-20',
    area: 'Tasks',
    title: 'A verified-human task',
    items: [
      `A task type that checks a wallet with ${human}.`,
      'It fails closed: a task with missing verification settings doesn’t pass.',
    ],
  },
  {
    date: '2025-11-07',
    area: 'Tasks',
    title: 'Telegram membership checks',
    items: ['Our bot checks that a participant has joined a Telegram channel or group.', 'Invite links on Telegram tasks are validated.'],
  },
  {
    date: '2025-09-20',
    area: 'Tasks',
    title: 'Discord membership checks',
    items: ['Our bot checks that a participant has joined a Discord server.'],
  },
  {
    date: '2025-08-31',
    area: 'Contracts',
    title: 'Contract update, phase 1',
    items: [
      'OpenZeppelin ReentrancyGuard and Pausable.',
      'Separate host and admin roles.',
      'Campaign time windows enforced by the contract.',
      'Rate limits against spam.',
    ],
  },
  {
    date: '2025-08-13',
    area: 'AI',
    title: 'Draft a campaign with AI',
    items: ['Generate a title, description and tasks from a short project description, then edit them before you publish.'],
  },
  {
    date: '2025-08-05',
    area: 'Contracts',
    title: 'Anyone can become a host',
    items: ['One transaction on the Create Campaign page registers your wallet as a host. No admin approval.'],
  },
  {
    date: '2025-08-02',
    area: 'App',
    title: 'DappDrop v1.0',
    items: ['Hosts create campaigns and add tasks.', 'Participants join, complete tasks and track their progress.', 'A host dashboard with analytics.'],
  },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "2025-09-20" → "20 Sep 2025" (fixed, locale-independent: the page is static). */
function long(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export default function ChangelogPage() {
  const entries = ENTRIES.filter((e) => e.show !== false)
  return (
    <>
      <section aria-labelledby="hero-title" data-section="hero" className="lp-container pb-12 pt-12 md:pb-16 md:pt-20">
        <p className="font-mono text-eyebrow font-medium uppercase text-ink-3">Changelog</p>
        <h1 id="hero-title" className="mh-display mt-4 text-[clamp(2.5rem,1.6rem+3.6vw,4.75rem)] leading-[1.02] text-ink">
          What’s shipped.
        </h1>
        <p className="mt-6 max-w-[36rem] text-lead text-ink-2">
          Releases of the DappDrop app and contracts, newest first.{' '}
          <a href={`${repos.app}/commits`} target="_blank" rel="noopener noreferrer" className="lp-link" data-dest="changelog_commits">
            Every commit on GitHub ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </section>

      <section aria-label="Releases" data-section="releases" className="lp-container pb-20 md:pb-28">
        <ol className="border-b border-rule">
          {entries.map((e) => (
            <li key={e.date + e.title} className="grid gap-3 border-t border-rule py-8 md:grid-cols-12 md:gap-8 md:py-10">
              <p className="font-mono text-[0.8125rem] uppercase tracking-[0.06em] text-ink-3 md:col-span-3">
                <time dateTime={e.date}>{long(e.date)}</time>
                <span aria-hidden="true" className="mx-2">
                  ·
                </span>
                <span className="text-signal">{e.area}</span>
              </p>
              <article className="md:col-span-8 md:col-start-5">
                <h2 className="mh-display text-[clamp(1.5rem,1.25rem+0.9vw,2rem)] leading-[1.12] text-ink">{e.title}</h2>
                <ul className="mt-3 space-y-1.5 text-body text-ink-2">
                  {e.items.map((t) => (
                    <li key={t} className="flex gap-3">
                      <span aria-hidden="true" className="text-ink-3">
                        –
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
        {claims.contractsDeployedOn && (
          <p className="mt-6 font-mono text-[0.8125rem] uppercase tracking-[0.06em] text-ink-3">Contracts last deployed {claims.contractsDeployedOn}</p>
        )}
      </section>
      <PageJsonLd path="/changelog" name="Changelog" description={DESCRIPTION} />
    </>
  )
}
