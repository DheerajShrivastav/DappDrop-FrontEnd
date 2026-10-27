import type { Metadata } from 'next'
import { VaultStage } from '@/components/landing/vault'
import { HomeBeats, HomeFinal, HomeHero, HomeModes, HomeTrust, OLD_HASH_REDIRECT } from '@/components/landing/home'

// 07-wow: the Monolith homepage, a server component and fully static (○ in the build output).
// Every status-dependent line reads src/config/claims.ts at build time: no cookies(), headers()
// or searchParams here, or / turns dynamic. No wallet code.
//
// Order (copy §2): hero → Fund → Prove → Claim → tasks and payouts → trust line → final CTA.
// <VaultStage/> (owned by the 3D build, build contract §1) renders once, before the sections: a
// fixed full-viewport layer behind .mh-track. The detail moved to /how-it-works and /security.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function Home() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: OLD_HASH_REDIRECT }} />
      <VaultStage />
      <div className="mh-track">
        <HomeHero />
        {/* The scene's text equivalent (copy §4.2, TRS F12 verbatim): the stage is aria-hidden. */}
        <p className="sr-only" id="vault-desc">
          Host wallet → escrow contract → participant wallets. No DappDrop wallet in the path.
        </p>
        <HomeBeats />
        <HomeModes />
        <HomeTrust />
        <HomeFinal />
      </div>
    </>
  )
}
