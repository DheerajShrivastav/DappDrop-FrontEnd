"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, SearchX } from 'lucide-react';
import MarketingHeader from '@/components/marketing-header';
import Footer from '@/components/footer';

export default function NotFound() {
  const router = useRouter();

  return (
    <>
      <MarketingHeader />
      <main className="flex-grow flex flex-col items-center justify-center min-h-[80vh] px-4 text-center space-y-8 py-12">
        {/* Icon and Glitch effect container */}
        <div className="relative flex flex-col items-center justify-center">
          <div className="absolute -inset-8 bg-primary/20 blur-3xl rounded-full opacity-50 animate-pulse" />
          <SearchX className="w-24 h-24 text-primary relative z-10 animate-bounce duration-3000" />
        </div>

        <div className="space-y-4 max-w-md relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight font-space-grotesk text-foreground">
            404
          </h1>
          <h2 className="text-2xl font-semibold text-foreground/90">
            Page Not Found
          </h2>
          <p className="text-muted-foreground">
            Oops! It looks like you've ventured into uncharted territory. The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center z-10 relative mt-8">
          <Button asChild variant="default" size="lg" className="w-full sm:w-auto gap-2">
            <Link href="/">
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>
      </main>
      <Footer />
    </>
  );
}
