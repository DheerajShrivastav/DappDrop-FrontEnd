'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const benefits = [
  {
    title: 'Proof lives on-chain',
    description: 'Campaign tasks resolve to verifiable transactions and signatures so nobody questions how rewards were earned.',
  },
  {
    title: 'Ops burden disappears',
    description: 'Reviews, approvals, and fulfillment run through one workflow. No more juggling bots, forms, and wallet screenshots.',
  },
  {
    title: 'Communities stay human',
    description: 'Identity checks, rate limits, and device signals filter out farms before they ever touch your incentives.',
  },
]

export default function BenefitsSection() {
  return (
    <section id="benefits" className="px-6 py-24">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-[2.8rem]">
            Proof that the growth you report is the growth you earned.
          </h2>
          <p className="mt-6 max-w-xl text-lg text-slate-600">
            Projects use DAppDrop when they need every member of the room—marketing, product, investors—to see the impact without caveats.
          </p>

          <ul className="mt-10 space-y-5">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="flex gap-4">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                    {benefit.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 sm:text-base">
                    {benefit.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute -top-10 -left-8 hidden h-24 w-24 rounded-3xl border border-dashed border-slate-300/70 lg:block"></div>
          <div className="absolute -bottom-10 -right-8 hidden h-28 w-28 rotate-12 rounded-full border border-slate-200 bg-white/60 lg:block"></div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200 bg-slate-50 px-8 py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Case note · Solstice Labs
              </p>
              <p className="mt-2 text-base text-slate-600">
                Season launch converted lurkers into verified contributors in twelve days.
              </p>
            </div>

            <div className="grid gap-6 px-8 py-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Net new wallets</p>
                <p className="mt-3 text-4xl font-semibold text-slate-900">1,482</p>
                <p className="mt-2 text-sm text-slate-500">All verified through on-chain quests—zero manual reviews.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Completion funnel</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Intent captured</span>
                    <span className="font-semibold text-slate-900">2,305</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Passed verification</span>
                    <span className="font-semibold text-slate-900">1,587</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Rewards triggered</span>
                    <span className="font-semibold text-slate-900">1,482</span>
                  </div>
                </div>
              </div>

              <blockquote className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-600">
                “We walked into our community call with screenshots straight from the dashboard. No spreadsheets, no disclaimers—just proof that the campaign worked.”
              </blockquote>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
