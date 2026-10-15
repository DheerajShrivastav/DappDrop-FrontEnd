import type { Metadata } from 'next'
import { networkLabel } from '@/config/landing'
import {
  SecurityBuild,
  SecurityCanCant,
  SecurityCustody,
  SecurityHero,
  SecurityNotes,
  SecuritySafe,
  SecurityStart,
  SecurityStatus,
} from '@/components/landing/security'
import { HashDetailsOpener } from '@/components/landing/hash-details-opener'
import { PageJsonLd } from '@/components/landing/page-json-ld'

// 07-wow IA §3: the trust case, moved from the old homepage's #security. Static server component,
// no wallet code. The careful buyer reads the state first (status), then the claims.
const TITLE = 'Security at DappDrop: what we can and can’t do with your tokens'
const DESCRIPTION = `Not audited by a third party yet. Here’s what we do instead: verified contracts, public code, tests and published security notes. Public beta on ${networkLabel}.`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/security' },
  openGraph: { type: 'website', siteName: 'DappDrop', title: TITLE, description: DESCRIPTION, url: '/security' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export default function SecurityPage() {
  return (
    <>
      <SecurityHero />
      <SecurityStatus />
      <SecurityCustody />
      <SecurityCanCant />
      <SecurityBuild />
      <SecurityNotes />
      <SecuritySafe />
      <SecurityStart />
      <HashDetailsOpener />
      <PageJsonLd path="/security" name="Security" description={DESCRIPTION} />
    </>
  )
}
