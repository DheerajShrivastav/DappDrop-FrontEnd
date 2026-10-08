import Link from 'next/link'
import config from '@/app/config'
import { chainName } from '@/lib/reward-plan'

// Server component: no scroll listener, no back-to-top, no client JS (it renders on every page,
// including the landing page, which has a strict JS budget).
//
// Every link points somewhere real. The footer used to link /docs, /help, /terms, /privacy,
// /bug-bounty and friends — none of which exist — so each one 404'd, and Next prefetched them
// all as soon as the footer scrolled into view. Don't add a link here without a page behind it.
//
// No social icons: the old Telegram link belonged to another project, the Discord invite was
// dead and the X account's ownership is unconfirmed. Official handles render only once they're
// confirmed by the founder.
const FRONTEND_REPO = 'https://github.com/DheerajShrivastav/DappDrop-FrontEnd'
const CONTRACTS_REPO = 'https://github.com/DheerajShrivastav/Dapp-Drop-Smart-Contract'

const footerLinkClass = 'text-slate-300 hover:text-white text-sm transition-colors duration-200'

/** Internal routes go through next/link (never prefetched); external URLs are a plain new-tab <a>. */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    if (/^https?:\/\//.test(href)) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
                {children}
                <span className="sr-only"> (opens in a new tab)</span>
            </a>
        )
    }
    return (
        <Link href={href} prefetch={false} className={footerLinkClass}>
            {children}
        </Link>
    )
}

const footerNavigation = {
    product: [
        { name: 'Browse campaigns', href: '/campaigns' },
        { name: 'Create a campaign', href: '/create-campaign' },
        { name: 'Changelog', href: '/changelog' },
    ],
    resources: [
        { name: 'About', href: '/about' },
        { name: 'Documentation', href: `${FRONTEND_REPO}/tree/master/docs` },
        { name: 'README', href: `${FRONTEND_REPO}#readme` },
    ],
    developers: [
        { name: 'App code', href: FRONTEND_REPO },
        { name: 'Contracts code', href: CONTRACTS_REPO },
        { name: 'Integration guides', href: `${FRONTEND_REPO}/tree/master/docs/integrations` },
    ],
}

function FooterColumn({ title, items }: { title: string; items: { name: string; href: string }[] }) {
    return (
        <nav aria-label={title}>
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">{title}</h2>
            <ul className="space-y-3">
                {items.map((item) => (
                    <li key={item.name}>
                        <FooterLink href={item.href}>{item.name}</FooterLink>
                    </li>
                ))}
            </ul>
        </nav>
    )
}

export default function Footer() {
    const network = chainName(config.chainId)
    return (
        <footer className="bg-slate-900 border-t border-slate-800">
            <div className="container mx-auto px-4 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
                    <div className="lg:col-span-1">
                        <Link href="/" prefetch={false} className="inline-block mb-4 font-headline font-bold text-xl text-white">
                            DappDrop
                        </Link>
                        <p className="text-white font-medium text-sm mb-3">Quest campaigns, settled on-chain.</p>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Public beta on {network} testnet. Not audited yet.
                        </p>
                    </div>
                    <FooterColumn title="Product" items={footerNavigation.product} />
                    <FooterColumn title="Resources" items={footerNavigation.resources} />
                    <FooterColumn title="For developers" items={footerNavigation.developers} />
                </div>
            </div>

            <div className="border-t border-slate-800">
                <div className="container mx-auto px-4 py-6">
                    <p className="text-slate-300 text-sm">
                        We will never ask for your seed phrase or private key. © 2026 Dheeraj Shrivastav
                    </p>
                </div>
            </div>
        </footer>
    )
}
