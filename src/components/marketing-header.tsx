import Link from 'next/link';
import { Menu, Rocket } from 'lucide-react';

export default function MarketingHeader() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-soft">
            <div className="container flex h-16 items-center gap-2 px-4 md:px-8">
                <Link href="/" className="flex min-w-0 items-center gap-2.5 md:mr-8">
                    <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-2 rounded-xl shadow-elevated">
                        <Rocket className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-headline font-bold text-xl bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                        DappDrop
                    </span>
                </Link>
                {/* Desktop nav; on phones the same links sit in the menu so nothing overflows. */}
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium flex-1">
                    <Link href="/campaigns" className='text-slate-600 hover:text-primary transition-colors font-semibold'>
                        Campaigns
                    </Link>
                    <Link href="/about" className='text-slate-600 hover:text-primary transition-colors'>
                        About
                    </Link>
                    <Link href="/changelog" className='text-slate-600 hover:text-primary transition-colors'>
                        Changelog
                    </Link>
                </nav>
                <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-4">
                    <Link
                        href="/campaigns"
                        className="inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 md:px-6"
                    >
                        Launch App
                    </Link>
                    {/* No-JS phone menu (this header is a server component). */}
                    <details className="relative md:hidden">
                        <summary
                            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
                            aria-label="Open menu"
                        >
                            <Menu className="h-5 w-5" />
                        </summary>
                        <nav className="absolute right-0 top-12 z-50 flex w-48 flex-col rounded-md border bg-white p-1 text-sm shadow-md">
                            <Link href="/campaigns" className="rounded px-3 py-2 hover:bg-slate-100">Campaigns</Link>
                            <Link href="/about" className="rounded px-3 py-2 hover:bg-slate-100">About</Link>
                            <Link href="/changelog" className="rounded px-3 py-2 hover:bg-slate-100">Changelog</Link>
                        </nav>
                    </details>
                </div>
            </div>
        </header>
    );
}
