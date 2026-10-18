'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Menu, Rocket } from 'lucide-react';
import { useRole } from '@/hooks/use-role';
import { NotificationBell } from '@/components/notification-bell';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Header() {
    const { role } = useRole();

    const links = [
        { href: '/campaigns', label: 'Campaigns', strong: true },
        // Marketing pages aren't prefetched from the app (keeps app navigation lean).
        { href: '/about', label: 'About', prefetch: false },
        { href: '/changelog', label: 'Changelog', prefetch: false },
        ...(role === 'host' ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-soft">
            <div className="container flex h-16 items-center gap-2 px-4 md:px-8">
                <Link href="/" prefetch={false} className="flex min-w-0 items-center gap-2.5 md:mr-8">
                    <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-2 rounded-xl shadow-elevated">
                        <Rocket className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-headline font-bold text-xl bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                        DappDrop
                    </span>
                </Link>
                {/* Desktop nav. On phones these links live in the menu below, so the header
                    never forces the page wider than the screen. */}
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium flex-1">
                    {links.map((l) => (
                        <Link
                            key={l.href}
                            href={l.href}
                            prefetch={l.prefetch}
                            className={`text-slate-600 hover:text-primary transition-colors${l.strong ? ' font-semibold' : ''}`}
                        >
                            {l.label}
                        </Link>
                    ))}
                </nav>
                <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-4">
                    <NotificationBell />
                    <span className="sm:hidden">
                        <ConnectButton
                            label="Connect"
                            showBalance={false}
                            chainStatus="icon"
                            accountStatus="avatar"
                        />
                    </span>
                    <span className="hidden sm:block">
                        <ConnectButton
                            showBalance={false}
                            accountStatus={{
                                smallScreen: 'avatar',
                                largeScreen: 'full',
                            }}
                        />
                    </span>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Open menu"
                        >
                            <Menu className="h-5 w-5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {links.map((l) => (
                                <DropdownMenuItem key={l.href} asChild>
                                    <Link href={l.href} prefetch={l.prefetch}>{l.label}</Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
