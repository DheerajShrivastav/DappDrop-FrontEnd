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
            <main className="flex-grow">{children}</main>
            <Footer />
        </>
    );
}
