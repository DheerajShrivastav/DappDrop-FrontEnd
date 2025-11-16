'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

export default function CTASection() {
  return (
    <section id="campaigns" className="px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.08)]"
      >
        <div className="border-b border-slate-200 bg-slate-50 px-8 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Launch in a morning
          </span>
        </div>

        <div className="px-8 pb-10 pt-8 text-slate-900">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-[2.4rem]">
            Assemble your next drop, invite the right people, prove it worked.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            We will help you storyboard the flow, set up verification, and connect the reward rails. After that it is your story to tell.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              href="/create-campaign"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Book a build session
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              View the product
            </Link>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {["No wallet? We walk you through.", 'Live onboarding support.', 'Analytics configured for your next report.'].map((item) => (
              <div key={item} className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50 p-4 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  )
}
