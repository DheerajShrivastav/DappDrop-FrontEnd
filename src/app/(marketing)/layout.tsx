import { SiteHeader } from '@/components/landing/site-header';
import { SiteFooter } from '@/components/landing/site-footer';
import { Analytics } from '@/components/landing/analytics';
import { JsonLd } from '@/components/landing/json-ld';
import { display, mono } from '@/app/_fonts/landing-fonts';

/**
 * /about and /changelog: the older marketing pages. They keep the light paper tokens (they use
 * the app's Inter + shadcn styles) and share the landing header and footer, without the theme
 * toggle. The Monolith pages live in the (landing) group.
 */
export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${display.variable} ${mono.variable} lp-page flex min-h-screen flex-grow flex-col`}>
            {/* QW-05: the first tab stop on every marketing page. */}
            <a href="#main" className="skip-link">
                Skip to main content
            </a>
            <SiteHeader />
            {/* tabIndex -1: the skip link and in-page jumps move keyboard focus here too. */}
            <main id="main" tabIndex={-1} className="flex-grow outline-none">
                {children}
            </main>
            <SiteFooter />
            <Analytics />
            <JsonLd />
        </div>
    );
}
