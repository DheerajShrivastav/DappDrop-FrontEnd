import { claims } from '@/config/claims'
import { analyticsDomain, copyrightHolder, explorerCodeUrl, network, networkLabel, officialDomain, officialLinks, repos } from '@/config/landing'
import { participantsLink, START_HREF } from './nav'
import { Wordmark } from './wordmark'

/**
 * S1-14 / 07-wow IA §4.3: the marketing footer (TRS F82–F85): Brand · Product · Trust · Company.
 * A server component on the ink band (a raised dark band in both Monolith themes). No status light, no unverified socials, no back-to-top
 * script, no next/link. "Official links" render only once the founder confirms handles (C3).
 * The app keeps its own footer (src/components/footer.tsx), because the privacy line below
 * ("loads no wallet code") is only true on marketing pages.
 */
const linkCls = 'inline-flex min-h-10 items-center text-small text-paper-2 can-hover:hover:text-paper can-hover:hover:underline'

function Ext({ href, children, name }: { href: string; children: React.ReactNode; name: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
      {children}
      <span className="sr-only">: {name} (opens in a new tab)</span>
    </a>
  )
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-mono text-[0.75rem] font-medium uppercase tracking-[0.06em] text-paper">{title}</h2>
      <ul className="mt-2">{children}</ul>
    </nav>
  )
}

export function SiteFooter() {
  const ref = claims.deployedTag ?? 'dev'
  const source = explorerCodeUrl(network.entrypoint)
  return (
    <footer className="lp-ink relative z-[1]">
      <div className="lp-container pb-10 pt-12 lg:pb-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <a href="/" className="text-paper" aria-label="DappDrop home">
              <Wordmark />
            </a>
            <p className="mt-3 text-small text-paper">Quest campaigns, settled on-chain.</p>
            <p className="mt-1 text-small text-paper-2">Public beta on {networkLabel}. Not audited yet.</p>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:col-span-8">
            <Col title="Product">
              <li>
                <a href={START_HREF} className={linkCls} data-cta="footer_start" data-loc="footer">
                  Start a campaign
                </a>
              </li>
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
              {source && (
                <li>
                  <Ext href={source} name={`the verified source on ${network.explorerName}`}>
                    Contracts on {network.explorerName} ↗
                  </Ext>
                </li>
              )}
              <li>
                <Ext href={`${repos.contracts}/blob/${ref}/docs/SECURITY_FINDINGS.md`} name="our security notes on GitHub">
                  Security notes ↗
                </Ext>
              </li>
              <li>
                <Ext href={repos.contracts} name="the contracts repository on GitHub">
                  Code on GitHub ↗
                </Ext>
              </li>
            </Col>
            <Col title="Company">
              <li>
                <a href="/about" className={linkCls}>
                  About
                </a>
              </li>
              <li>
                <a href="/how-it-works#faq" className={linkCls}>
                  FAQ
                </a>
              </li>
              {claims.founderContact && (
                <li>
                  <Ext href={claims.founderContact.url} name="talk to the founder">
                    Talk to the founder ↗
                  </Ext>
                </li>
              )}
              <li>
                <Ext href={`${repos.app}/issues`} name="GitHub issues">
                  Ask on GitHub ↗
                </Ext>
                <span className="block text-[0.75rem] text-paper-2">Never post a seed phrase or private key.</span>
              </li>
            </Col>
          </div>
        </div>

        {officialLinks.length > 0 && (
          <nav aria-label="Official links" className="mt-8">
            <h2 className="font-mono text-[0.75rem] font-medium uppercase tracking-[0.06em] text-paper">Official links</h2>
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

        <div className="mt-10 space-y-1.5 border-t border-rule pt-5 text-[0.8125rem] text-paper-2">
          {claims.contractsDeployedOn && (
            <p>
              Contracts last deployed: {claims.contractsDeployedOn} ·{' '}
              <a href="/changelog" className="lp-link">
                Changelog →
              </a>
            </p>
          )}
          <p>
            <strong className="font-semibold text-paper">We will never ask for your seed phrase or private key.</strong> The official
            site is {officialDomain}; anything else isn&apos;t us.
          </p>
          <p>{analyticsDomain ? 'This page uses cookieless analytics (Plausible) and loads no wallet code.' : 'This page loads no wallet code.'}</p>
          <p>© 2026 {copyrightHolder}</p>
        </div>
      </div>
    </footer>
  )
}
