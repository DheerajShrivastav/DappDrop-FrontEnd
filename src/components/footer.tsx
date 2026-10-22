'use client'

import Link from 'next/link'
import { Rocket, Github, ArrowUp } from 'lucide-react'
import { useState, useEffect } from 'react'

// Every link points somewhere real. The footer used to link /docs, /help, /terms, /privacy,
// /bug-bounty and friends — none of which exist — so each one 404'd, and Next prefetched them
// all as soon as the footer scrolled into view. Don't add a link here without a page behind it.
//
// Social links: only accounts the project has verified as its own. The old Twitter, Discord
// and Telegram links pointed at handles DappDrop doesn't own (t.me/dappdrop is someone else's
// group; the Discord invite is dead), so they're gone until official accounts exist. Same for
// claims: no status line without a status page, no "secure"/"Sybil-resistant" marketing.
const FRONTEND_REPO = 'https://github.com/DheerajShrivastav/DappDrop-FrontEnd'
const CONTRACTS_REPO = 'https://github.com/DheerajShrivastav/Dapp-Drop-Smart-Contract'

const footerLinkClass = 'text-slate-400 hover:text-white text-sm transition-colors duration-200'

/** Internal routes go through next/link; external URLs are a plain new-tab <a> (nothing for
 * Next to prefetch). */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    if (/^https?:\/\//.test(href)) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
                {children}
            </a>
        )
    }
    return (
        <Link href={href} className={footerLinkClass}>
            {children}
        </Link>
    )
}

// Footer navigation links
const footerNavigation = {
    product: [
        { name: 'Campaigns', href: '/campaigns' },
        { name: 'Create a Campaign', href: '/create-campaign' },
        { name: 'Changelog', href: '/changelog' },
    ],
    resources: [
        { name: 'About', href: '/about' },
        { name: 'Documentation', href: `${FRONTEND_REPO}/tree/master/docs` },
        { name: 'README', href: `${FRONTEND_REPO}#readme` },
    ],
    developers: [
        { name: 'GitHub Repository', href: FRONTEND_REPO },
        { name: 'Smart Contracts', href: CONTRACTS_REPO },
        { name: 'Integration Guides', href: `${FRONTEND_REPO}/tree/master/docs/integrations` },
    ],
    social: [
        { name: 'GitHub', href: FRONTEND_REPO, icon: Github },
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
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            Task-based community campaigns with rewards held in an on-chain escrow. In beta on the Sepolia testnet.
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
                                    <FooterLink href={item.href}>{item.name}</FooterLink>
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
                                    <FooterLink href={item.href}>{item.name}</FooterLink>
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
                                    <FooterLink href={item.href}>{item.name}</FooterLink>
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

                        <div className="flex items-center gap-6">
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
