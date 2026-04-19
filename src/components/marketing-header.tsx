import Link from 'next/link';
import { Rocket } from 'lucide-react';

export default function MarketingHeader() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-soft">
            <div className="container flex h-16 items-center">
                <Link href="/" className="flex items-center gap-2.5 mr-8">
                    <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-2 rounded-xl shadow-black-glow">
                        <Rocket className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-headline font-bold text-xl bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                        DappDrop
                    </span>
                </Link>
                <nav className="flex items-center gap-8 text-sm font-medium flex-1">
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
                <div className="flex items-center gap-4">
                    <Link
                        href="/campaigns"
                        className="inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6"
                    >
                        Launch App
                    </Link>
                </div>
            </div>
        </header>
    );
}
