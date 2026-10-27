import { network } from '@/config/landing'
import { HeaderState } from './header-state'
import { IntentPrefetch } from './intent-prefetch'
import { MenuDialog } from './menu-dialog'
import { MENU_EXTRA_LINKS, NAV_LINKS, START_HREF } from './nav'
import { ThemeToggle } from './theme-toggle'
import { headerButton, pillButton } from './ui'
import { Wordmark } from './wordmark'

/**
 * 07-wow IA §4: the marketing header (server component + two tiny islands).
 *
 * Desktop (≥ 1024): wordmark · How it works · Security · FAQ · For participants / Browse
 * campaigns · [Start a campaign] · theme toggle. Phone: wordmark · ● Testnet · [Start] · toggle ·
 * Menu (native <dialog>). Solid on scroll, transparent at the very top; no blur. The CTA goes
 * straight to the app, prefetched only on intent. Every marketing page (the (landing) group:
 * /, /how-it-works, /security, /about, /changelog) is themed and shows the toggle.
 */
export function SiteHeader() {
  const navLink =
    'inline-flex h-11 items-center text-small text-ink-2 underline-offset-4 aria-[current=page]:text-ink aria-[current=page]:underline can-hover:hover:text-ink can-hover:hover:underline'

  return (
    <header className="lp-header sticky top-0 z-40 border-b border-rule bg-paper">
      <div className="lp-container flex h-16 items-center gap-1.5 sm:gap-3">
        <a href="/" className="flex min-w-0 shrink items-baseline text-ink" aria-label="DappDrop home">
          <Wordmark className="whitespace-nowrap max-[359px]:text-[1.25rem]" />
        </a>

        {network.testnet && (
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-eyebrow uppercase text-ink-2 lg:hidden">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
            {/* Text at ≥ 440 px (the bar also holds the theme toggle); below that the dot keeps an
                accessible name (A11-crit). */}
            <span className="sr-only min-[440px]:not-sr-only">Testnet</span>
          </span>
        )}

        <nav aria-label="Main" className="ml-auto hidden items-center gap-6 lg:flex">
          <ul className="flex items-center gap-6">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className={navLink} data-nav>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <IntentPrefetch href={START_HREF} className={headerButton} cta="header_start" loc="header">
            Start a campaign
          </IntentPrefetch>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 min-[360px]:gap-1.5 sm:gap-2 lg:ml-0">
          <span className="lg:hidden">
            <IntentPrefetch href={START_HREF} className={headerButton} cta="header_start" loc="header">
              Start<span className="sr-only"> a campaign</span>
            </IntentPrefetch>
          </span>
          <ThemeToggle />
          <span className="lg:hidden">
            <MenuDialog>
              <nav aria-label="Menu" className="px-5 py-2">
                <ul>
                  {NAV_LINKS.map((l) => (
                    <li key={l.href} className="border-b border-rule">
                      <a href={l.href} className="flex min-h-11 items-center py-2 text-body text-ink" data-nav>
                        {l.label}
                      </a>
                    </li>
                  ))}
                  {MENU_EXTRA_LINKS.map((l) => (
                    <li key={l.href} className="border-b border-rule">
                      {l.external ? (
                        <a href={l.href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center py-2 text-body text-ink">
                          {l.label} <span aria-hidden="true">&nbsp;↗</span>
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        <a href={l.href} className="flex min-h-11 items-center py-2 text-body text-ink">
                          {l.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                <IntentPrefetch href={START_HREF} className={`${pillButton} mt-5 w-full`} cta="header_start" loc="menu">
                  Start a campaign
                </IntentPrefetch>
              </nav>
            </MenuDialog>
          </span>
        </div>
      </div>
      <HeaderState />
    </header>
  )
}
