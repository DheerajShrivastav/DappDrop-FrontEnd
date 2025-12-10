'use client'

import Link from 'next/link'
import { Rocket, Twitter, Github, ArrowUp } from 'lucide-react'
import { useState, useEffect } from 'react'

// Discord and Telegram icons (not in lucide-react)
const DiscordIcon = () => (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
)

const TelegramIcon = () => (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
)

// Footer navigation links
const footerNavigation = {
    product: [
        { name: 'How It Works', href: '/#how-it-works' },
        { name: 'Active Campaigns', href: '/campaigns' },
        { name: 'Verification Tools', href: '/#verification-tools' },
        { name: 'Documentation', href: '/docs' },
    ],
    resources: [
        { name: 'Help Center', href: '/help' },
        { name: 'API Documentation', href: '/docs/api' },
        { name: 'Community Guidelines', href: '/guidelines' },
        { name: 'Terms of Service', href: '/terms' },
        { name: 'Privacy Policy', href: '/privacy' },
    ],
    developers: [
        { name: 'GitHub Repository', href: 'https://github.com/DheerajShrivastav/DappDrop-FrontEnd' },
        { name: 'Smart Contracts', href: '/docs/contracts' },
        { name: 'Integration Guides', href: '/docs/integration' },
        { name: 'Bug Bounty', href: '/bug-bounty' },
    ],
    social: [
        { name: 'Twitter', href: 'https://twitter.com/dappdrop', icon: Twitter },
        { name: 'Discord', href: 'https://discord.gg/dappdrop', icon: DiscordIcon },
        { name: 'Telegram', href: 'https://t.me/dappdrop', icon: TelegramIcon },
        { name: 'GitHub', href: 'https://github.com/DheerajShrivastav/DappDrop-FrontEnd', icon: Github },
    ],
}

export default function Footer() {
    const [showBackToTop, setShowBackToTop] = useState(false)

    // Show "Back to Top" button when user scrolls down
    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <footer className="bg-slate-900 border-t border-slate-800">
            {/* Main Footer Content */}
            <div className="container mx-auto px-4 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">

                    {/* Column 1: Brand & Description */}
                    <div className="lg:col-span-1">
                        <Link href="/" className="flex items-center gap-2.5 mb-4">
                            <div className="bg-gradient-to-br from-slate-600 to-slate-800 p-2 rounded-xl">
                                <Rocket className="h-5 w-5 text-white" />
                            </div>
                            <span className="font-headline font-bold text-xl text-white">
                                DappDrop
                            </span>
                        </Link>
                        <p className="text-primary font-medium text-sm mb-3">
                            Community Building Reimagined
                        </p>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            Secure verification tools for Web3 communities. Build engaged audiences with Sybil-resistant proof-of-humanity.
                        </p>

                        {/* Social Media Icons */}
                        <div className="flex items-center gap-4">
                            {footerNavigation.social.map((item) => (
                                <a
                                    key={item.name}
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-white transition-all duration-200 hover:scale-110"
                                    aria-label={item.name}
                                >
                                    <item.icon />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Column 2: Product */}
                    <div>
                        <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
                            Product
                        </h3>
                        <ul className="space-y-3">
                            {footerNavigation.product.map((item) => (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className="text-slate-400 hover:text-white text-sm transition-colors duration-200"
                                    >
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: Resources */}
                    <div>
                        <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
                            Resources
                        </h3>
                        <ul className="space-y-3">
                            {footerNavigation.resources.map((item) => (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className="text-slate-400 hover:text-white text-sm transition-colors duration-200"
                                    >
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 4: For Developers */}
                    <div>
                        <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
                            For Developers
                        </h3>
                        <ul className="space-y-3">
                            {footerNavigation.developers.map((item) => (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className="text-slate-400 hover:text-white text-sm transition-colors duration-200"
                                        {...(item.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    >
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-slate-800">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        {/* Copyright */}
                        <p className="text-slate-500 text-sm">
                            © {new Date().getFullYear()} DappDrop. All rights reserved.
                        </p>

                        {/* Status Indicator & Back to Top */}
                        <div className="flex items-center gap-6">
                            {/* Status Indicator */}
                            <div className="flex items-center gap-2 text-sm">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <span className="text-slate-400">All Systems Operational</span>
                            </div>

                            {/* Back to Top Button */}
                            {showBackToTop && (
                                <button
                                    onClick={scrollToTop}
                                    className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors duration-200"
                                    aria-label="Back to top"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                    <span className="hidden sm:inline">Back to top</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
