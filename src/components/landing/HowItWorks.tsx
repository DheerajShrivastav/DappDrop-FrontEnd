'use client'

import { motion } from 'framer-motion'

const steps = [
  {
    label: '01',
    title: 'Shape the path',
    description:
      'Pick a template, plug in the outcomes you want, and stitch together the on-chain and social actions that matter.',
    detail: 'Tasks can be gated by role, assets held, or previous completions so the right people see the right next step.',
  },
  {
    label: '02',
    title: 'Run the drop',
    description:
      'Publish to your audience and watch progress in real time. Verification runs silently in the background.',
    detail: 'Flagged submissions sit in review while clean entries flow right through to the reward queue.',
  },
  {
    label: '03',
    title: 'Report the proof',
    description:
      'Share the campaign wrap-up with contributors, investors, and your ops team without exporting a single CSV.',
    detail: 'Snapshots and audit trails live alongside task performance so you can answer any “was this real?” question instantly.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-16">
        <div className="max-w-3xl">
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-[2.8rem]"
          >
            Three deliberate steps, no growth theater.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-4 max-w-2xl text-lg text-slate-600"
          >
            DAppDrop keeps the ops tight so you can focus on telling the story. Launch, moderate, and prove impact without piecing together six tools.
          </motion.p>
        </div>

        <div className="relative grid gap-12 lg:grid-cols-3">
          <div className="absolute left-4 top-0 bottom-0 hidden w-px bg-gradient-to-b from-slate-200 via-slate-200/40 to-transparent lg:block"></div>
          {steps.map((step, index) => (
            <motion.article
              key={step.label}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="relative rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold text-slate-600">
                  {step.label}
                </span>
                <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-slate-600 sm:text-base">
                {step.description}
              </p>
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300/80 bg-slate-50 p-4 text-sm text-slate-500">
                {step.detail}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
