import Footer from '@/components/footer';

// Server component with NO client components: Next renders the root not-found boundary into
// every page's payload, so anything client-side here loads on the landing page too. In
// particular next/link must not be imported here: Next attributed it to the (app) layout's
// chunk group, which pulled the wallet bundles onto /. Plain <a> only, and a static header (the
// landing header has client islands).
export default function NotFound() {
  return (
    <>
      <header className="border-b border-border bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <a href="/" className="text-lg font-semibold tracking-tight text-foreground">
            DappDrop
          </a>
          <a href="/how-it-works" className="text-sm text-muted-foreground hover:text-foreground">
            How it works
          </a>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-grow flex flex-col items-center justify-center min-h-[60vh] px-4 text-center py-16">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center">
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-transparent bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to the home page
          </a>
          <a
            href="/campaigns"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-input bg-white px-6 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Browse campaigns
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
