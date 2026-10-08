import Link from 'next/link'
import { network } from '@/config/landing'
import { MenuDialog } from '@/components/landing/menu-dialog'
import { Wordmark } from '@/components/landing/wordmark'
import { headerButton } from '@/components/landing/ui'
import { browseCampaigns, MENU_EXTRA_LINKS, SECTION_LINKS, START_HREF } from '@/components/landing/nav'

/**
 * S1-02: the marketing header (server component). Plan §2.0.
 *
 * Desktop (≥1024): wordmark (+ descriptor ≥1280) · section anchors · "Browse campaigns" ·
 * filled "Start a campaign". Phone: wordmark · "● Testnet" · Start · Menu (native <dialog>).
 * Solid paper with a 1 px rule: no blur, no gradient, no status light. Nothing is prefetched.
 */
export default function MarketingHeader() {
  const navLink = 'inline-flex h-11 items-center text-small text-ink-2 can-hover:hover:text-ink can-hover:hover:underline underline-offset-4'

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper">
      <div className="lp-container flex h-16 items-center gap-3">
        <Link href="/" prefetch={false} className="flex min-w-0 shrink items-baseline gap-3 text-ink" aria-label="DappDrop home">
          <Wordmark className="truncate" />
          <span className="hidden whitespace-nowrap font-mono text-eyebrow uppercase text-ink-3 xl:inline">
            Quest campaigns, settled on-chain
          </span>
        </Link>

        {network.testnet && (
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-eyebrow uppercase text-ink-2 lg:hidden">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink-2" />
            {/* Text at ≥375 px; below that the dot keeps an accessible name (A11-crit). */}
            <span className="sr-only min-[375px]:not-sr-only">Testnet</span>
          </span>
        )}

        <nav aria-label="Main" className="ml-auto hidden items-center gap-6 lg:flex">
          <ul className="flex items-center gap-5">
            {SECTION_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className={navLink}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a href={browseCampaigns.href} className="lp-link inline-flex h-11 items-center text-small font-medium">
            {browseCampaigns.label}
          </a>
          <a href={START_HREF} className={headerButton} data-cta="header_start" data-loc="header">
            Start a campaign
          </a>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:hidden">
          <a href={START_HREF} className={headerButton} data-cta="header_start" data-loc="header">
            Start
          </a>
          <MenuDialog>
            <nav aria-label="Menu" className="px-5 py-2">
              <ul>
                {SECTION_LINKS.map((l) => (
                  <li key={l.href} className="border-b border-rule">
                    <a href={l.href} className="flex min-h-11 items-center py-2 text-body text-ink">
                      {l.label}
                    </a>
                  </li>
                ))}
                <li className="border-b border-rule">
                  <a href={browseCampaigns.href} className="flex min-h-11 items-center py-2 text-body text-ink">
                    {browseCampaigns.label}
                  </a>
                </li>
                {MENU_EXTRA_LINKS.map((l) => (
                  <li key={l.href} className="border-b border-rule">
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center py-2 text-body text-ink">
                        {l.label} <span aria-hidden="true">&nbsp;↗</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <Link href={l.href} prefetch={false} className="flex min-h-11 items-center py-2 text-body text-ink">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <a href={START_HREF} className={`${headerButton} mt-5 w-full`} data-cta="header_start" data-loc="menu">
                Start a campaign
              </a>
            </nav>
          </MenuDialog>
        </div>
      </div>
    </header>
  )
}
