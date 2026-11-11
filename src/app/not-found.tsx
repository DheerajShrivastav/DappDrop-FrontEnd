import { display, mono } from '@/app/_fonts/landing-fonts'
import { network } from '@/config/landing'
import { CompactFooter } from '@/components/landing/compact-footer'
import { NAV_LINKS, START_HREF } from '@/components/landing/nav'
import { headerButton, pillButton } from '@/components/landing/ui'
import { Wordmark } from '@/components/landing/wordmark'

// Server component with NO client components: Next renders the root not-found boundary into
// every page's payload, so anything client-side here loads on the landing page too. In
// particular next/link must not be imported here: Next attributed it to the (app) layout's
// chunk group, which pulled the wallet bundles onto /. Plain <a> only, and a static header (the
// landing header has client islands: the theme toggle, the phone menu, the intent prefetch).
// scripts/check-landing-imports.mjs checks this file along with the landing code.
//
// Monolith in both themes: `.lp-theme` maps the Obsidian / Porcelain tokens (globals.css), and
// <html data-theme> is set before paint by the root layout's no-flash script, so the 404 renders
// in the visitor's remembered theme without a toggle of its own.
const outlinePill =
  'inline-flex h-12 items-center justify-center rounded-full border border-rule-strong px-6 text-body font-medium leading-none text-ink transition-colors [transition-duration:var(--dur-micro)] can-hover:hover:border-ink active:translate-y-px'

export default function NotFound() {
  return (
    <div className={`${display.variable} ${mono.variable} lp-page lp-theme flex min-h-screen flex-grow flex-col`} data-not-found="">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-rule bg-paper">
        <div className="lp-container flex h-16 items-center gap-1.5 sm:gap-3">
          <a href="/" className="flex min-w-0 shrink items-baseline text-ink" aria-label="DappDrop home">
            <Wordmark className="whitespace-nowrap max-[359px]:text-[1.25rem]" />
          </a>
          {network.testnet && (
            <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-eyebrow uppercase text-ink-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
              <span className="sr-only min-[440px]:not-sr-only">Testnet</span>
            </span>
          )}
          <nav aria-label="Main" className="ml-auto flex items-center gap-6">
            <ul className="hidden items-center gap-6 lg:flex">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="inline-flex h-11 items-center text-small text-ink-2 underline-offset-4 can-hover:hover:text-ink can-hover:hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <a href={START_HREF} className={headerButton}>
              {/* A no-break space: a plain one would collapse at the start of the flex item. */}
              Start<span className="max-sm:sr-only">&nbsp;a campaign</span>
            </a>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-grow outline-none">
        <div className="lp-container pb-20 pt-14 md:pb-28 md:pt-24">
          <p className="font-mono text-eyebrow uppercase text-ink-3">404 · Page not found</p>
          <h1 className="mh-display mt-4 max-w-[14em] text-[clamp(2.5rem,1.6rem+3.2vw,4rem)] leading-[1.02] text-ink">This page doesn’t exist.</h1>
          <p className="mt-5 max-w-[46ch] text-body text-ink-2 md:text-[1.125rem] md:leading-[1.55]">
            It may have moved, or the link is wrong. Campaigns live at /campaign/ followed by their number.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="/" className={pillButton}>
              Back to the home page
            </a>
            <a href="/campaigns" className={outlinePill}>
              Browse campaigns
            </a>
          </div>
        </div>
      </main>

      <CompactFooter />
    </div>
  )
}
