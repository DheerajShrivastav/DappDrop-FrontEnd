'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, Check } from 'lucide-react'

const proofPoints = [
  'Wallet-gated tasks keep sybils out',
  'Reward drops land straight in your contracts',
  'Analytics stitched to the exact action users take',
]

const stats = [
  { value: '4.7x', label: 'Faster to first cohort' },
  { value: '63%', label: 'Repeat campaign creators' },
  { value: '92%', label: 'Verified human submissions' },
]

export default function Hero() {
  return (
    <section className="relative px-6 pt-32 pb-24">
      <div className="absolute inset-x-0 top-24 mx-auto h-96 max-w-5xl rounded-3xl bg-white/70 blur-2xl"></div>

      <div className="relative mx-auto grid max-w-6xl gap-16 lg:grid-cols-[1.1fr,0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col"
        >
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-slate-300/80 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Built for community leads
          </span>

          <h1 className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.2rem]">
            Launch campaigns your audience actually wants to finish.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-slate-600 sm:text-xl">
            DAppDrop helps you orchestrate on-chain tasks, reward the right people, and show proof that your growth came from real humans—not farm accounts.
          </p>

          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              href="/#campaigns"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Start a campaign
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/#campaigns"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              Browse live examples
            </Link>
          </div>

          <ul className="mt-12 space-y-4">
            {proofPoints.map((point) => (
              <li key={point} className="flex gap-3 text-sm text-slate-600">
                <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700">
                  <Check className="h-3 w-3" />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="text-2xl font-semibold text-slate-900">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute -top-10 -right-10 hidden h-32 w-32 rounded-full border border-dashed border-slate-300/70 sm:block"></div>
          <div className="absolute -bottom-12 -left-8 hidden h-24 w-24 rotate-6 rounded-2xl border border-slate-200 bg-white/60 sm:block"></div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Campaign dashboard
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Real-time view across tasks, wallets, and issued rewards.
              </p>
            </div>

            <div className="grid gap-6 px-6 py-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Completion rate</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">86%</p>
                  </div>
                  <span className="rounded-full bg-emerald-100/70 px-3 py-1 text-xs font-medium text-emerald-700">
                    +12% vs last drop
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Top tasks</div>
                <dl className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <dt>Mint loyalty credential</dt>
                    <dd className="font-semibold text-slate-900">1,248</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Join Telegram hub</dt>
                    <dd className="font-semibold text-slate-900">948</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Verify builder NFT</dt>
                    <dd className="font-semibold text-slate-900">712</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">No more spreadsheets.</p>
                <p className="mt-2">
                  Every task is stored on-chain with signer proofs so you can reconcile rewards without passing around CSV exports.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
