
'use client'

import { CheckCircle, Gift, PlusCircle, Rocket, Users, Zap, ShieldCheck, ShieldOff, Bot } from 'lucide-react'

const hostMilestones = [
  {
    step: '01',
    title: 'Design the journey',
    description:
      'Template your campaign, stack gated tasks, and line up the stories you want new members to experience first.',
  },
  {
    step: '02',
    title: 'Verify on autopilot',
    description:
      'Let DAppDrop run the checks—wallet ownership, social proof, allowlists—while you focus on the narrative.',
  },
  {
    step: '03',
    title: 'Reward the believers',
    description:
      'Trigger token drops, credential mints, or merch claims directly from the dashboard with full audit trails.',
  },
]

const participantMilestones = [
  {
    step: '01',
    title: 'Spot the missions',
    description:
      'Browse live drops and find the communities aligned with how you build, collect, or contribute.',
  },
  {
    step: '02',
    title: 'Prove your moves',
    description:
      'Complete verifiable tasks on-chain and off-chain. Your wallet becomes the resume; no screenshots required.',
  },
  {
    step: '03',
    title: 'Claim and keep building',
    description:
      'Unlock rewards that pull you deeper into the project—roles, tokens, IRL passes, and more.',
  },
]

const comparison = [
  {
    title: 'The old playbook',
    icon: ShieldOff,
    tone: 'text-rose-500',
    body: [
      'Forms flooded with bots make ops teams second-guess every submission.',
      'Spreadsheet approvals and DM screenshots slow launch momentum.',
      'Participants barely touch the product before rewards go out.',
    ],
  },
  {
    title: 'The DAppDrop way',
    icon: ShieldCheck,
    tone: 'text-sky-600',
    body: [
      'On-chain signatures and device checks surface the believers instantly.',
      'Reward logic lives in contracts, so fulfillment is trustless and fast.',
      'Campaign narratives guide users through the exact experiences you envisioned.',
    ],
  },
]

const pillars = [
  {
    title: 'Transparent infrastructure',
    icon: Zap,
    description:
      'Every quest, verification, and reward is immutably tracked so you can share proof with your team, community, or investors.',
  },
  {
    title: 'Flexible orchestration',
    icon: PlusCircle,
    description:
      'Mix on-chain actions with social checkpoints, role gates, or custom logic. Reuse sequences or build entirely new ones in minutes.',
  },
  {
    title: 'Meaningful rewards',
    icon: Gift,
    description:
      'Drop tokens, loyalty badges, or physical claims once participants cross the finish line—no spreadsheets or manual approvals.',
  },
]

export default function AboutPage() {
  return (
    <div className="bg-[#f6f2eb] text-slate-900">
      <section className="relative overflow-hidden px-6 pb-24 pt-28">
        <div className="absolute inset-x-24 top-12 h-48 rounded-full bg-gradient-to-r from-sky-200/60 via-blue-100/50 to-indigo-200/60 blur-3xl" />
        <div className="mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 shadow-sm">
            Why DAppDrop exists
          </span>
          <h1 className="mt-8 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            We build campaign rails that make community growth feel intentional, not artificial.
          </h1>
          <p className="mt-6 text-lg text-slate-600 sm:text-xl">
            DAppDrop replaces chaotic forms and bot armies with a guided, measurable journey that proves every win came from real people.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-3">
          {[{ value: '12.4K', label: 'Verified participants' }, { value: '640', label: 'Campaigns orchestrated' }, { value: '92%', label: 'Average task completion' }].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/60 bg-white/70 px-6 py-5 text-left shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
            >
              <p className="text-3xl font-semibold text-slate-900">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-10 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">For project hosts</h2>
            <p className="mt-4 text-base text-slate-600">
              You bring the vision. We provide the infrastructure that keeps growth sprints tidy, measurable, and human.
            </p>
            <div className="mt-10 space-y-6">
              {hostMilestones.map((item) => (
                <div key={item.step} className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm">
                  <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700">
                      {item.step}
                    </span>
                    {item.title}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/70 p-10 shadow-[0_25px_80px_rgba(59,130,246,0.12)] backdrop-blur">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">For participants</h2>
            <p className="mt-4 text-base text-slate-600">
              Earn your spot by proving it on-chain. Campaigns reward the exact behavior teams need, not the fastest form filler.
            </p>
            <div className="mt-10 space-y-6">
              {participantMilestones.map((item) => (
                <div key={item.step} className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm">
                  <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700">
                      {item.step}
                    </span>
                    {item.title}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-24">
        <div className="absolute inset-x-12 top-10 h-56 rounded-3xl bg-gradient-to-r from-sky-200/50 via-white/40 to-indigo-200/50 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-16 grid gap-8 rounded-3xl border border-white/60 bg-white/75 p-10 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="grid gap-8 lg:grid-cols-2">
              {comparison.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="rounded-3xl border border-slate-200/80 bg-white/70 p-8 shadow-sm">
                    <div className="flex items-center gap-4">
                      <span className={`rounded-2xl border border-white/70 bg-white p-3 shadow-inner ${item.tone}`}>
                        <Icon className="h-6 w-6" />
                      </span>
                      <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    </div>
                    <ul className="mt-6 space-y-3 text-sm text-slate-600">
                      {item.body.map((line) => (
                        <li key={line} className="flex gap-3">
                          <span className="mt-1 inline-block h-1.5 w-6 rounded-full bg-slate-300" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-8 shadow-sm">
              <div className="flex gap-4 text-slate-600">
                <Rocket className="h-6 w-6 flex-shrink-0 text-sky-500" />
                <p className="text-sm leading-relaxed">
                  DAppDrop is built by operators who have run campaigns, managed allowlists, and babysat spreadsheets at 3 A.M. We translated that pain into infrastructure that keeps your team focused on storytelling—not triaging bots.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 rounded-3xl border border-white/60 bg-white/80 p-10 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:grid-cols-3">
            {pillars.map((pillar) => {
              const Icon = pillar.icon
              return (
                <div key={pillar.title} className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm">
                  <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-3 text-sky-500">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{pillar.title}</h3>
                  <p className="mt-3 text-sm text-slate-600">{pillar.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}

    