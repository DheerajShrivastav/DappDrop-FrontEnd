import type { Metadata } from 'next'
import { network } from '@/config/landing'
import { Hero } from '@/components/landing/hero'
import { ProofSlot } from '@/components/landing/proof-slot'
import { Payouts } from '@/components/landing/payouts'
import { HowSteps } from '@/components/landing/how-steps'
import { TaskMatrix } from '@/components/landing/task-matrix'
import { StickyStartBar } from '@/components/landing/sticky-start-bar'

// S1-04: the landing page is a server component and fully static (○ in the build output). Every
// status-dependent line reads src/config/claims.ts at build time: no cookies(), headers() or
// searchParams here, or / turns dynamic.
//
// Pass 1 builds the chrome, hero, statement slip, trace and proof row. Sections #payouts, #how,
// #verification, #security, #participants, #pricing, #faq and #start come in pass 2 (S1-08+).
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
      <StickyStartBar helper={network.testnet ? `${network.name} · no platform fee` : 'No platform fee during beta'} />
    </>
  )
}
