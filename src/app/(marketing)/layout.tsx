import MarketingHeader from '@/components/marketing-header';
import Footer from '@/components/footer';
import { Analytics } from '@/components/landing/analytics';
import { StatusStrip } from '@/components/landing/status-strip';
import { display, mono } from './fonts';

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // S1-01: the landing fonts' CSS variables and the paper surface. A real element (not
        // display:contents) so the paper background paints; it fills the body's flex column.
        <div className={`${display.variable} ${mono.variable} lp-page flex min-h-screen flex-grow flex-col`}>
            {/* QW-05: the first tab stop on every marketing page. */}
            <a href="#main" className="skip-link">
                Skip to main content
            </a>
            <StatusStrip />
            <MarketingHeader />
            {/* tabIndex -1: the skip link and in-page jumps move keyboard focus here too. */}
            <main id="main" tabIndex={-1} className="flex-grow outline-none">
                {children}
            </main>
            <Footer plain />
            <Analytics />
        </div>
    );
}
