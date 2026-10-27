import Link from 'next/link'
import { claims } from '@/config/claims'
import { analyticsDomain, copyrightHolder, explorerCodeUrl, network, networkLabel, officialDomain, repos } from '@/config/landing'

/**
 * The compact app footer (08-site phase 1; app-design §1.4, founder decision: no giant wordmark).
 * The statement footer's content in a tighter layout: the serif line and the status line on the
 * left; Product · Trust · Developers · Company and the seed-phrase card on the right; the bottom
 * bar. Server component (no client JS of its own). Link micro-interactions are the marketing
 * footer's CSS (.ft-link / .ft-u / .ft-arrow in globals.css).
 *
 * App routes use next/link (never prefetched); marketing routes a plain <a>.
 */
const linkCls = 'ft-link inline-flex min-h-10 items-center text-small text-ink-2 can-hover:hover:text-ink focus-visible:text-ink'

function AppRoute({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch={false} className={linkCls}>
      <span className="ft-u">{children}</span>
    </Link>
  )
}

function Page({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={linkCls}>
      <span className="ft-u">{children}</span>
    </a>
  )
}

function Ext({ href, children, name, className = linkCls }: { href: string; children: React.ReactNode; name: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
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
      <h2 className="font-mono text-[0.75rem] font-normal uppercase leading-4 tracking-[0.12em] text-ink-3">{title}</h2>
      <ul className="mt-3">{children}</ul>
    </nav>
  )
}

export function AppFooter() {
  const ref = claims.deployedTag ?? 'dev'
  const source = explorerCodeUrl(network.entrypoint)
  const explorerShort = network.explorerName.replace(new RegExp(`^${network.name}\\s+`), '')

  return (
    <footer className="mt-8 border-t border-rule bg-paper text-ink" data-app-footer>
      <div className="lp-container pb-8 pt-12">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_3fr] lg:gap-12">
          <div>
            <p className="dd-display max-w-[13em] text-[1.75rem] leading-[1.1] text-ink">
              {claims.hostCloseGuarded ? 'Don’t promise rewards. Lock them in.' : 'Quest campaigns, settled on-chain.'}
            </p>
            <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-2">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-signal" />
              <span>{network.testnet ? `Public beta · ${networkLabel}` : 'Public beta'}</span>
              {source && (
                <>
                  <span aria-hidden="true">·</span>
                  <Ext href={source} name={`the verified contract source on ${network.explorerName}`} className="ft-link inline-flex min-h-10 items-center text-ink can-hover:hover:text-ink">
                    Contracts verified on {explorerShort}
                  </Ext>
                </>
              )}
            </p>
          </div>

          <div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
              <Col title="Product">
                <li>
                  <Page href="/how-it-works">How it works</Page>
                </li>
                <li>
                  <AppRoute href="/campaigns">Campaigns</AppRoute>
                </li>
                <li>
                  <Page href="/how-it-works#faq">FAQ</Page>
                </li>
              </Col>
              <Col title="Trust">
                <li>
                  <Page href="/security">Security</Page>
                </li>
                <li>
                  <Page href="/security#can-cant">What we can&apos;t do</Page>
                </li>
                <li>
                  <Ext href={`${repos.contracts}/blob/${ref}/docs/SECURITY_FINDINGS.md`} name="our security notes on GitHub">
                    Security notes
                  </Ext>
                </li>
              </Col>
              <Col title="Developers">
                <li>
                  <Ext href={repos.contracts} name="the contracts repository on GitHub">
                    Contracts code
                  </Ext>
                </li>
                <li>
                  <Ext href={repos.app} name="the app repository on GitHub">
                    App code
                  </Ext>
                </li>
                <li>
                  <Ext href={`${repos.app}/issues`} name="GitHub issues">
                    Ask on GitHub
                  </Ext>
                </li>
              </Col>
              <Col title="Company">
                <li>
                  <Page href="/about">About</Page>
                </li>
                <li>
                  <Page href="/changelog">Changelog</Page>
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
            <div className="mt-7 flex max-w-[34rem] items-start gap-3 rounded-lg border border-rule bg-surface px-[1.1rem] py-[0.9rem] text-[0.8125rem] text-ink-2">
              <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" className="mt-0.5 shrink-0 text-signal" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                <path d="M10 2.2 3.6 4.6v5c0 4 2.7 6.9 6.4 8.2 3.7-1.3 6.4-4.2 6.4-8.2v-5L10 2.2Z" />
                <path d="m7.2 10 2 2 3.8-4" strokeLinecap="round" />
              </svg>
              <p>
                <strong className="block font-semibold text-ink">We&apos;ll never ask for your seed phrase or private key.</strong>
                The official site is <span className="[overflow-wrap:anywhere]">{officialDomain}</span>; anything else isn&apos;t us.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-rule pt-5 font-mono text-[0.75rem] uppercase tracking-[0.12em] text-ink-3">
          <p>© 2026 {copyrightHolder}</p>
          <p className="sm:mx-auto">
            Built on {network.name}
            {analyticsDomain && ' · Cookieless analytics'}
          </p>
          <a href="#main" className="ft-link ml-auto inline-flex min-h-10 items-center text-ink-3 can-hover:hover:text-ink focus-visible:text-ink sm:ml-0" data-back-to-top>
            <span className="ft-u">Back to top</span>
            <span aria-hidden="true" className="ft-arrow ft-arrow--up ml-1.5">
              ↑
            </span>
          </a>
        </div>
      </div>
    </footer>
  )
}
