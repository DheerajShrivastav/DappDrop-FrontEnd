'use client'

import { motion } from 'framer-motion'
import { Compass, Gauge, ShieldCheck, Sparkles } from 'lucide-react'

const featureGroups = [
  {
    title: 'Campaign orchestration',
    icon: Compass,
    description: 'Template your journey, stack tasks, and launch in minutes without touching spreadsheets.',
    bullets: ['Template library tuned for quests, allowlists, and loyalty pilots', 'Conditional logic keeps participants on the right path'],
  },
  {
    title: 'Verification guardrails',
    icon: ShieldCheck,
    description: 'Wallet checks, social proof, and device signals flag the bad actors before rewards go out.',
    bullets: ['Built-in Sybil heuristics with manual overrides when you need them', 'Ledger of verified actions stored on-chain for auditability'],
  },
  {
    title: 'Reward logistics',
    icon: Sparkles,
    description: 'Issue tokens, credentials, or merch claims automatically once an action clears review.',
    bullets: ['Escrow wallets and signing workflows handled for the team', 'Track redemptions and mark depleted inventory at a glance'],
  },
  {
    title: 'Growth telemetry',
    icon: Gauge,
    description: 'Understand which channels produce believers versus tourists with cohort-ready analytics.',
    bullets: ['Journey analytics stitched to wallet activity and socials', 'Exports that drop straight into your investor updates'],
  },
]

export default function Features() {
  return (
    <section id="features" className="relative px-6 py-24">
      <div className="absolute inset-x-0 top-16 h-24 bg-gradient-to-r from-transparent via-white/70 to-transparent"></div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-16">
        <div className="max-w-2xl">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500"
          >
            What teams ship with
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-[2.7rem]"
          >
            Everything you need to guide real people from discovery to conviction.
          </motion.h2>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {featureGroups.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -120px 0px' }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </span>
                  <h3 className="text-xl font-semibold text-slate-900">{feature.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                  {feature.description}
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-600">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-slate-400"></span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
