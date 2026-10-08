import Link from 'next/link';
import MarketingHeader from '@/components/marketing-header';
import Footer from '@/components/footer';

// Server component (no client JS): Next includes the not-found chunk in every route's
// script list, so a client 404 page cost the landing page a few KB for nothing.
export default function NotFound() {
  return (
    <>
      <MarketingHeader />
      <main id="main" tabIndex={-1} className="flex-grow flex flex-col items-center justify-center min-h-[60vh] px-4 text-center py-16">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center">
          <Link
            href="/"
            prefetch={false}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-transparent bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to the home page
          </Link>
          <Link
            href="/campaigns"
            prefetch={false}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-input bg-white px-6 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Browse campaigns
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
