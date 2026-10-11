import type { Metadata } from 'next'
import { network } from '@/config/landing'
import { Hero } from '@/components/landing/hero'
import { ProofSlot } from '@/components/landing/proof-slot'
import { Payouts } from '@/components/landing/payouts'
import { HowSteps } from '@/components/landing/how-steps'
import { TaskMatrix } from '@/components/landing/task-matrix'
import { Security } from '@/components/landing/security'
import { Participants } from '@/components/landing/participants'
import { Pricing } from '@/components/landing/pricing'
import { Faq } from '@/components/landing/faq'
import { StartPanel } from '@/components/landing/start-panel'
import { HashDetailsOpener } from '@/components/landing/hash-details-opener'
import { StickyStartBar } from '@/components/landing/sticky-start-bar'

// S1-04: the landing page is a server component and fully static (○ in the build output). Every
// status-dependent line reads src/config/claims.ts at build time: no cookies(), headers() or
// searchParams here, or / turns dynamic.
//
// Order (UXA): hero → proof row → #payouts → #how → #verification → #security →
// #participants → #pricing → #faq → #start (ink band, continuous with the footer).
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function Home() {
  return (
    <>
      <Hero />
      <ProofSlot />
      <Payouts />
      <HowSteps />
      <TaskMatrix />
      <Security />
      <Participants />
      <Pricing />
      <Faq />
      <StartPanel />
      <HashDetailsOpener />
      <StickyStartBar helper={network.testnet ? `${network.name} · no platform fee` : 'No platform fee during beta'} />
    </>
  )
}
