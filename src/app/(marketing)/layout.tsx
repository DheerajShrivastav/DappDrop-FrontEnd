import MarketingHeader from '@/components/marketing-header';
import Footer from '@/components/footer';

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* QW-05: the first tab stop on every marketing page. */}
            <a href="#main" className="skip-link">
                Skip to main content
            </a>
            <MarketingHeader />
            {/* tabIndex -1: the skip link and in-page jumps move keyboard focus here too. */}
            <main id="main" tabIndex={-1} className="flex-grow outline-none">
                {children}
            </main>
            <Footer />
        </>
    );
}
