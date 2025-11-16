'use client'

import Link from 'next/link'
import { OrbitingCircles } from '@/registry/magicui/orbiting-circles'
import { primaryCtaClasses, secondaryCtaClasses } from './button-variants'
import { Badge } from '@/components/ui/badge'
import { LineChart, ShieldCheck, Sparkles, Users, Wallet } from 'lucide-react'

const valuePoints = [
  {
    title: 'Signal the right audience',
    description:
      'Mix on-chain checkpoints with curated social tasks so every participant earns their place instead of buying a role.',
  },
  {
    title: 'Automate the trust layer',
    description:
      'Wallet scorecards, device fingerprints, and moderator overrides ship in the box—no bots or spreadsheets required.',
  },
  {
    title: 'Prove impact instantly',
    description:
      'Campaign receipts update live, letting you share dashboards with founders, contributors, or investors in real time.',
  },
]

const orbitIcons = [
  { icon: ShieldCheck, tone: 'from-emerald-400 to-emerald-500' },
  { icon: Wallet, tone: 'from-sky-400 to-blue-500' },
  { icon: Users, tone: 'from-amber-400 to-orange-500' },
  { icon: Sparkles, tone: 'from-fuchsia-400 to-purple-500' },
  { icon: LineChart, tone: 'from-indigo-400 to-indigo-500' },
]

export default function OrbitingShowcase() {
  return (
    <section className="relative px-6 py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-30 mix-blend-screen [background-image:radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.28),transparent_55%),radial-gradient(circle_at_84%_22%,rgba(129,140,248,0.24),transparent_55%),radial-gradient(circle_at_48%_82%,rgba(251,191,36,0.22),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(129,140,248,0.08) 1px, transparent 1px)',
            backgroundSize: '180px 180px',
          }}
        />
        <div className="absolute left-1/2 top-14 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-br from-sky-200/25 via-white/20 to-indigo-200/25 blur-[120px]" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
        <div>
          <Badge variant="outline" className="mb-6 border-slate-300/60 bg-white/70 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Why teams choose DAppDrop
          </Badge>
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-[2.9rem]">
            Every orbit of your campaign is covered—from discovery, to verification, to the proof you report back.
          </h2>
          <p className="mt-6 max-w-xl text-lg text-slate-600">
            DAppDrop blends orchestration tools with a human layer. Operators design immersive quests, DAppDrop handles the guardrails, and contributors experience a journey that feels intentional.
          </p>

          <ul className="mt-10 space-y-6">
            {valuePoints.map((point) => (
              <li key={point.title} className="flex gap-4">
                <span className="mt-[6px] inline-flex h-2.5 w-2.5 flex-none rounded-full bg-gradient-to-br from-sky-400 to-indigo-500" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{point.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 sm:text-base">{point.description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/#campaigns" className={primaryCtaClasses}>
              Build your first orbit
            </Link>
            <Link href="/about" className={secondaryCtaClasses}>
              Meet the playbook
            </Link>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 -z-10 rounded-[32px] border border-slate-200/60 bg-white/70 shadow-[0_28px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl" />
          <div className="relative flex h-[520px] w-full max-w-[460px] flex-col items-center justify-center overflow-hidden rounded-[30px] border border-slate-200/70 bg-white/80 p-10 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="pointer-events-none absolute inset-0 opacity-[0.25] [background-image:radial-gradient(circle_at_top_right,rgba(129,140,248,0.28),transparent_60%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.24),transparent_55%)]" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="rounded-full border border-slate-200/70 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Verification layer
              </span>
              <p className="mt-4 max-w-sm text-sm text-slate-600">
                Each icon represents the orbit of signals DAppDrop coordinates: wallets, social proof, contributor cohorts, growth analytics, and trust automation.
              </p>
            </div>
            <div className="relative mt-10 flex items-center justify-center">
              <div className="absolute h-40 w-40 rounded-full border border-dashed border-slate-200/60" />
              <div className="absolute h-60 w-60 rounded-full border border-slate-200/50" />
              <OrbitingCircles iconSize={54} radius={140}>
                {orbitIcons.map(({ icon: Icon, tone }) => (
                  <span
                    key={`${tone}-${Icon.name}`}
                    className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${tone} text-white shadow-[0_12px_30px_rgba(59,130,246,0.25)]`}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                ))}
              </OrbitingCircles>
              <OrbitingCircles iconSize={44} radius={90} reverse speed={1.6}>
                {orbitIcons.slice(0, 4).map(({ icon: Icon, tone }, index) => (
                  <span
                    key={`${tone}-${index}`}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/80 text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.28)]`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                ))}
              </OrbitingCircles>
            </div>
            <div className="relative z-10 mt-10 grid w-full gap-3 text-left text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Live telemetry</p>
                <p className="mt-2 text-slate-700">Campaign health, verified submissions, and payout queues update as each orbit completes.</p>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-300/70 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Human overrides</p>
                <p className="mt-2 text-slate-700">Ops teams can pause or fast-track participants without leaving the narrative journey.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
