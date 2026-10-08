import Link from 'next/link'
import Footer, { type InternalLink } from './footer'

// The app's footer: internal links use next/link (client-side navigation keeps the wallet
// providers mounted), never prefetched.
const AppLink: InternalLink = ({ href, className, children }) => (
    <Link href={href} prefetch={false} className={className}>
        {children}
    </Link>
)

export default function AppFooter() {
    return <Footer Internal={AppLink} />
}
