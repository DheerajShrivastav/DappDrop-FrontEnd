import { claims } from '@/config/claims'
import { analyticsDomain, copyrightHolder, explorerCodeUrl, network, networkLabel, officialDomain, officialLinks, repos } from '@/config/landing'
import { FooterLight } from './footer-light'
import { IntentPrefetch } from './intent-prefetch'
import { participantsLink, START_HREF } from './nav'
import { pillButton } from './ui'
import { Wordmark } from './wordmark'

/**
 * The statement footer (founder brief 2026-10-14; IA §4.3; TRS F82–F85). A server component on
 * the page colour (Obsidian / Porcelain; light on /about and /changelog), above the fixed vault
 * stage (z-index 1).
 *
 * - Top-left: the small wordmark, the tagline, one "Start a campaign" pill (footer_primary) and
 *   honest trust chips driven by claims.ts / landing.ts, exactly like the homepage trust line.
 * - "Find us at": only handles the founder confirmed in landing.ts `officialLinks` (C3). None today,
 *   so nothing renders. Never invented.
 * - Link columns: Product · Trust · Developers · Company. Only routes and links that exist. No
 *   Legal column until legal pages exist (founder placeholder D11).
 * - The signature: a giant, full-width "DappDrop" (aria-hidden; the brand is real text above),
 *   filled with the vault's gold light, cropped by the page edge. CSS fill, scroll-driven "coins
 *   rising" and a cursor light (FooterLight, < 1 KB); static and complete under reduced motion.
 *
 * The app keeps its own footer (src/components/footer.tsx): "loads no wallet code" is only true here.
 */
const linkCls = 'inline-flex min-h-10 items-center text-small text-ink-2 can-hover:hover:text-ink can-hover:hover:underline underline-offset-4'

function Ext({ href, children, name, dest }: { href: string; children: React.ReactNode; name: string; dest?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkCls} data-dest={dest}>
      {children}
      <span className="sr-only">: {name} (opens in a new tab)</span>
    </a>
  )
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-mono text-[0.75rem] font-medium uppercase tracking-[0.08em] text-ink-3">{title}</h2>
      <ul className="mt-3">{children}</ul>
    </nav>
  )
}

const chip = 'inline-flex min-h-8 items-center gap-2 rounded-[1rem] border border-rule-strong px-3 py-1 text-[0.8125rem] leading-snug text-ink-2'

export function SiteFooter() {
  const ref = claims.deployedTag ?? 'dev'
  const source = explorerCodeUrl(network.entrypoint)
  return (
    <footer className="ft relative z-[1] overflow-hidden border-t [overflow:clip] border-rule bg-paper text-ink" data-footer>
      <div className="lp-container pb-8 pt-14 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <a href="/" className="inline-block text-ink" aria-label="DappDrop home">
              <Wordmark />
            </a>
            <p className="mt-3 text-body text-ink-2">Quest campaigns, settled on-chain.</p>
            <div className="mt-7">
              <IntentPrefetch href={START_HREF} className={pillButton} cta="footer_primary" loc="footer">
                Start a campaign
              </IntentPrefetch>
            </div>
            {/* Honest chips instead of badges: the same flags as the homepage trust line. */}
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="Status">
              <li>
                {source ? (
                  <a href={source} target="_blank" rel="noopener noreferrer" className={`${chip} text-ink can-hover:hover:border-ink`} data-dest="explorer_footer">
                    Contracts verified on {network.explorerName} <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (the verified source, opens in a new tab)</span>
                  </a>
                ) : (
                  <span className={chip}>Contracts verified on {network.explorerName}</span>
                )}
              </li>
              <li className={chip}>{claims.licenseFile ? 'Open source (MIT)' : 'Public code'}</li>
              <li className={chip}>Not audited yet</li>
              <li className={chip}>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
                {network.testnet ? `Public beta · ${networkLabel}` : 'Public beta'}
              </li>
            </ul>
            {officialLinks.length > 0 && (
              <nav aria-label="Find us at" className="mt-8">
                <h2 className="font-mono text-[0.75rem] font-medium uppercase tracking-[0.08em] text-ink-3">Find us at</h2>
                <ul className="mt-2 flex flex-wrap gap-x-5">
                  {officialLinks.map((l) => (
                    <li key={l.url}>
                      <Ext href={l.url} name={l.label}>
                        {l.label} ↗
                      </Ext>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:col-span-7">
            <Col title="Product">
              <li>
                <a href="/how-it-works" className={linkCls}>
                  How it works
                </a>
              </li>
              <li>
                <a href={participantsLink.href} className={linkCls} data-cta="footer_browse" data-loc="footer">
                  {participantsLink.label}
                </a>
              </li>
              <li>
                <a href="/how-it-works#faq" className={linkCls}>
                  FAQ
                </a>
              </li>
              <li>
                <a href="/changelog" className={linkCls}>
                  Changelog
                </a>
              </li>
            </Col>
            <Col title="Trust">
              <li>
                <a href="/security" className={linkCls}>
                  Security
                </a>
              </li>
              <li>
                <a href="/security#can-cant" className={linkCls}>
                  What we can&apos;t do
                </a>
              </li>
              <li>
                <Ext href={`${repos.contracts}/blob/${ref}/docs/SECURITY_FINDINGS.md`} name="our security notes on GitHub" dest="security_notes">
                  Security notes ↗
                </Ext>
              </li>
            </Col>
            <Col title="Developers">
              <li>
                <Ext href={repos.contracts} name="the contracts repository on GitHub" dest="footer_contracts_code">
                  Contracts code ↗
                </Ext>
              </li>
              <li>
                <Ext href={repos.app} name="the app repository on GitHub" dest="footer_app_code">
                  App code ↗
                </Ext>
              </li>
              <li>
                <Ext href={`${repos.app}/issues`} name="GitHub issues" dest="github_issues">
                  Ask on GitHub ↗
                </Ext>
              </li>
            </Col>
            <Col title="Company">
              <li>
                <a href="/about" className={linkCls}>
                  About
                </a>
              </li>
              {claims.founderContact && (
                <li>
                  <Ext href={claims.founderContact.url} name="talk to the founder">
                    Talk to the founder ↗
                  </Ext>
                </li>
              )}
            </Col>
          </div>
        </div>

        <div className="mt-14 space-y-1.5 border-t border-rule pt-6 text-[0.8125rem] text-ink-2">
          <p>
            <strong className="font-semibold text-ink">We will never ask for your seed phrase or private key.</strong> The official site
            is {officialDomain}; anything else isn&apos;t us. Never post a seed phrase or private key in an issue.
          </p>
          <p>
            Public beta on {networkLabel}. Not audited yet.{' '}
            {analyticsDomain ? 'This page uses cookieless analytics (Plausible) and loads no wallet code.' : 'This page loads no wallet code.'}
          </p>
          {claims.contractsDeployedOn && (
            <p>
              Contracts last deployed: {claims.contractsDeployedOn} ·{' '}
              <a href="/changelog" className="lp-link">
                Changelog →
              </a>
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-x-6 gap-y-1 font-mono text-[0.75rem] uppercase tracking-[0.06em] text-ink-3">
          <p>© 2026 {copyrightHolder}</p>
          <p>Built on {network.name}</p>
        </div>
      </div>

      {/* The signature wordmark. Decorative: the brand is the real link above. */}
      <div className="ft-mark-wrap lp-container" aria-hidden="true">
        <span className="ft-mark" data-ft-mark>
          DappDrop
        </span>
      </div>
      <FooterLight />
    </footer>
  )
}
