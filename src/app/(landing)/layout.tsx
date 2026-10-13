import type { Viewport } from 'next'
import { SiteHeader } from '@/components/landing/site-header'
import { SiteFooter } from '@/components/landing/site-footer'
import { Analytics } from '@/components/landing/analytics'
import { JsonLd } from '@/components/landing/json-ld'
import { THEME_COLOR } from '@/components/landing/theme'
import { display, mono } from '@/app/_fonts/landing-fonts'

/**
 * 07-wow: the Monolith pages (/, /how-it-works, /security). Server components only, no wallet
 * code. `.lp-theme` scopes the Obsidian / Porcelain tokens (globals.css); <html data-theme> is set
 * before paint by the root layout's inline script. The app routes stay light.
 */
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: THEME_COLOR.obsidian,
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${mono.variable} lp-page lp-theme flex min-h-screen flex-grow flex-col`}>
      {/* QW-05: the first tab stop on every marketing page. */}
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader themed />
      {/* tabIndex -1: the skip link and in-page jumps move keyboard focus here too. */}
      <main id="main" tabIndex={-1} className="flex-grow outline-none">
        {children}
      </main>
      <SiteFooter />
      <Analytics />
      <JsonLd />
    </div>
  )
}
