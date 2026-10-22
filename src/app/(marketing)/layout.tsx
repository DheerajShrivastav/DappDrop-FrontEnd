import MarketingHeader from '@/components/marketing-header';
import Footer from '@/components/footer';

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <MarketingHeader />
            {/* The hero/bento decorations are oversized blurred blobs that bleed past the edge by
                design; clip them horizontally so they can't widen the page on phones. */}
            <main className="flex-grow overflow-x-clip">{children}</main>
            <Footer />
        </>
    );
}
