
'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Rocket } from 'lucide-react';
import { useRole } from '@/hooks/use-role';

export default function Header() {
    const { role } = useRole();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-soft">
            <div className="container flex h-16 items-center">
                <Link href="/" className="flex items-center gap-2.5 mr-8">
                    <div className="bg-gradient-to-br from-sky-400 to-blue-600 p-2 rounded-xl shadow-blue-glow">
                        <Rocket className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-headline font-bold text-xl bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                        DappDrop
                    </span>
                </Link>
                <nav className="flex items-center gap-8 text-sm font-medium flex-1">
                    <Link href="/about" className='text-slate-600 hover:text-primary transition-colors'>
                        About
                    </Link>
                    <Link href="/changelog" className='text-slate-600 hover:text-primary transition-colors'>
                        Changelog
                    </Link>
                    {role === 'host' && (
                        <Link href="/dashboard" className='text-slate-600 hover:text-primary transition-colors'>
                            Dashboard
                        </Link>
                    )}
                </nav>
                <div className="flex items-center gap-4">
                    <ConnectButton
                        showBalance={false}
                        accountStatus={{
                            smallScreen: 'avatar',
                            largeScreen: 'full',
                        }}
                    />
                </div>
            </div>
        </header>
    );
}
