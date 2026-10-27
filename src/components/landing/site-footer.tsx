import { claims } from '@/config/claims'
import { analyticsDomain, copyrightHolder, explorerCodeUrl, network, networkLabel, officialDomain, officialLinks, repos } from '@/config/landing'
import { FooterLight } from './footer-light'
import { IntentPrefetch } from './intent-prefetch'
import { participantsLink, START_HREF } from './nav'
import { pillButton } from './ui'

/**
 * The statement footer (founder brief 2026-10-14, polish 2026-10-15; IA §4.3; TRS F82–F85). A
 * server component on the page colour (Obsidian / Porcelain) on every marketing page,
 * above the fixed vault stage (z-index 1).
 *
 * - One brand moment: the giant wordmark at the bottom (aria-hidden). The left column leads with
 *   a serif statement (F78 behind hostCloseGuarded, like the H1), the "Start a campaign" pill
 *   (footer_primary) and one quiet trust row driven by claims.ts / landing.ts. No audit wording
 *   here (founder decision 2026-10-15: the audit status lives on /security only).
 * - "Find us at": only handles confirmed in landing.ts `officialLinks` (C3). None today.
 * - Columns: Product · Trust · Developers · Company, existing routes only. No Legal column until
 *   legal pages exist (founder placeholder D11).
 * - The safety callout, then the bottom row: © · Built on · Back to top (a plain #main anchor:
 *   smooth via the page's scroll-behavior / Lenis, instant under reduced motion; focus moves to
 *   <main>).
 * - Link micro-interactions are CSS only (globals.css, .ft-link).
 *
 * The app keeps its own footer (src/components/footer.tsx).
 */
const linkCls = 'ft-link inline-flex min-h-10 items-center text-small text-ink-2 can-hover:hover:text-ink focus-visible:text-ink'

function Int({ href, children, cta }: { href: string; children: React.ReactNode; cta?: string }) {
  return (
    <a href={href} className={linkCls} data-cta={cta} data-loc={cta ? 'footer' : undefined}>
      <span className="ft-u">{children}</span>
    </a>
  )
}

function Ext({ href, children, name, dest, className = linkCls }: { href: string; children: React.ReactNode; name: string; dest?: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} data-dest={dest}>
      <span className="ft-u">{children}</span>
      <span aria-hidden="true" className="ft-arrow ml-1">
        ↗
      </span>
      <span className="sr-only">: {name} (opens in a new tab)</span>
    </a>
  )
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-mono text-[0.75rem] font-medium uppercase leading-4 tracking-[0.08em] text-ink-3">{title}</h2>
      <ul className="mt-4">{children}</ul>
    </nav>
  )
}

function Sep() {
  return (
    <span aria-hidden="true" className="mx-2 text-ink-3">
      ·
    </span>
  )
}

export function SiteFooter() {
  const ref = claims.deployedTag ?? 'dev'
  const source = explorerCodeUrl(network.entrypoint)
  // "Sepolia Etherscan" → "Etherscan": the network is already named in "Public beta · …".
  const explorerShort = network.explorerName.replace(new RegExp(`^${network.name}\\s+`), '')
  const trust: React.ReactNode[] = [
    source ? (
      <Ext href={source} name={`the verified contract source on ${network.explorerName}`} dest="explorer_footer" className="ft-link text-ink-2 can-hover:hover:text-ink focus-visible:text-ink">
        Contracts verified on {explorerShort}
      </Ext>
    ) : (
      <>Contracts verified on {explorerShort}</>
    ),
    claims.licenseFile ? 'Open source (MIT)' : 'Public code',
    ...(claims.contractsDeployedOn ? [`Contracts deployed ${claims.contractsDeployedOn}`] : []),
  ]

  return (
    <footer className="ft relative z-[1] overflow-hidden border-t border-rule bg-paper text-ink [overflow:clip]" data-footer>
      <div className="lp-container pt-16 md:pt-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className="mh-display max-w-[13em] text-[clamp(2.25rem,1.75rem+1.4vw,2.75rem)] leading-[1.08] text-ink">
              {claims.hostCloseGuarded ? 'Don’t promise rewards. Lock them in.' : 'Quest campaigns, settled on-chain.'}
            </p>
            <div className="mt-8">
              <IntentPrefetch href={START_HREF} className={pillButton} cta="footer_primary" loc="footer">
                Start a campaign
              </IntentPrefetch>
            </div>
            {/* One quiet trust row: the same flags as the homepage trust line. Separators are CSS
                (.ft-trust); the one that would start a wrapped line is clipped. */}
            <div className="ft-trust mt-8">
              <ul className="text-small text-ink-2" aria-label="Status">
                <li>
                  <span aria-hidden="true" className="mr-2 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-signal align-middle" />
                  {network.testnet ? `Public beta · ${networkLabel}` : 'Public beta'}
                </li>
                {trust.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            {officialLinks.length > 0 && (
              <nav aria-label="Find us at" className="mt-8">
                <h2 className="font-mono text-[0.75rem] font-medium uppercase tracking-[0.08em] text-ink-3">Find us at</h2>
                <ul className="mt-2 flex flex-wrap gap-x-6">
                  {officialLinks.map((l) => (
                    <li key={l.url}>
                      <Ext href={l.url} name={l.label}>
                        {l.label}
                      </Ext>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>

          <div className="lg:col-span-7">
          {/* Column heads align with the statement's first line (its half-leading ≈ 8 px). */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:pt-2">
            <Col title="Product">
              <li>
                <Int href="/how-it-works">How it works</Int>
              </li>
              <li>
                <Int href={participantsLink.href} cta="footer_browse">
                  {participantsLink.label}
                </Int>
              </li>
              <li>
                <Int href="/how-it-works#faq">FAQ</Int>
              </li>
            </Col>
            <Col title="Trust">
              <li>
                <Int href="/security">Security</Int>
              </li>
              <li>
                <Int href="/security#can-cant">What we can&apos;t do</Int>
              </li>
              <li>
                <Ext href={`${repos.contracts}/blob/${ref}/docs/SECURITY_FINDINGS.md`} name="our security notes on GitHub" dest="security_notes">
                  Security notes
                </Ext>
              </li>
            </Col>
            <Col title="Developers">
              <li>
                <Ext href={repos.contracts} name="the contracts repository on GitHub" dest="footer_contracts_code">
                  Contracts code
                </Ext>
              </li>
              <li>
                <Ext href={repos.app} name="the app repository on GitHub" dest="footer_app_code">
                  App code
                </Ext>
              </li>
              <li>
                <Ext href={`${repos.app}/issues`} name="GitHub issues" dest="github_issues">
                  Ask on GitHub
                </Ext>
              </li>
            </Col>
            <Col title="Company">
              <li>
                <Int href="/about">About</Int>
              </li>
              <li>
                <Int href="/changelog">Changelog</Int>
              </li>
              {claims.founderContact && (
                <li>
                  <Ext href={claims.founderContact.url} name="talk to the founder">
                    Talk to the founder
                  </Ext>
                </li>
              )}
            </Col>
          </div>
            {/* The safety note as a callout (the "never post a seed phrase in an issue" line lives on
            /security#notes). */}
        <div className="mt-12 flex max-w-[35rem] gap-4 rounded-lg border border-rule bg-surface p-5 text-small text-ink-2">
          <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" className="mt-0.5 shrink-0 text-signal" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M10 2.2 3.6 4.6v5c0 4 2.7 6.9 6.4 8.2 3.7-1.3 6.4-4.2 6.4-8.2v-5L10 2.2Z" />
            <path d="m7.2 10 2 2 3.8-4" strokeLinecap="round" />
          </svg>
          <p>
            <strong className="block font-semibold text-ink">We&apos;ll never ask for your seed phrase or private key.</strong>
            The official site is <span className="whitespace-nowrap">{officialDomain}</span>; anything else isn&apos;t us.
          </p>
        </div>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-rule py-6 font-mono text-[0.75rem] uppercase tracking-[0.06em] text-ink-3">
          <p>© 2026 {copyrightHolder}</p>
          <p className="sm:mx-auto">
            Built on {network.name}
            {analyticsDomain && ' · Cookieless analytics'}
          </p>
          <a href="#main" className="ft-link ml-auto inline-flex min-h-10 items-center text-ink-2 can-hover:hover:text-ink focus-visible:text-ink sm:ml-0" data-back-to-top>
            <span className="ft-u">Back to top</span>
            <span aria-hidden="true" className="ft-arrow ft-arrow--up ml-1.5">
              ↑
            </span>
          </a>
        </div>
      </div>

      {/* The signature wordmark: the finale. Decorative; the brand is in the page's own text. */}
      <div className="ft-mark-wrap lp-container pt-12 md:pt-20" aria-hidden="true">
        <span className="ft-mark" data-ft-mark>
          DappDrop
        </span>
      </div>
      <FooterLight />
    </footer>
  )
}
