const spotlights = [
  {
    title: 'Solstice Labs',
    description: 'Activated 1,482 verified wallets in twelve days with a collector-first story arc and role-gated rewards.',
    statLabel: 'Completion rate',
    statValue: '86%',
  },
  {
    title: 'Beacon Guild',
    description: 'Moved their quest hub on-chain and cut bot submissions by 94% while keeping rewards instant.',
    statLabel: 'Sybil reduction',
    statValue: '94%',
  },
]

export default function CampaignSpotlight() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex flex-col gap-4 text-center sm:text-left">
          <span className="inline-flex w-fit items-center rounded-full border border-white/70 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 shadow-sm">
            Campaign spotlights
          </span>
          <div className="grid gap-6 sm:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)] sm:items-end">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.6rem]">
              Real teams are proving traction with quests that feel crafted, not churned out.
            </h2>
            <p className="text-base text-slate-600">
              We partner with community leads to storyboard the journey, capture the right signals, and automate the boring parts so creative energy stays where it matters.
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {spotlights.map((spotlight) => (
            <article
              key={spotlight.title}
              className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-200/40 via-white/10 to-indigo-200/40 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative flex h-full flex-col gap-6">
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{spotlight.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{spotlight.description}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-right shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {spotlight.statLabel}
                    </p>
                    <p className="text-2xl font-semibold text-slate-900">{spotlight.statValue}</p>
                  </div>
                </div>

                <div className="relative flex-1 overflow-hidden rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/70 p-6 text-sm text-slate-500">
                  <div className="pointer-events-none absolute inset-6 rounded-2xl border border-white/60 bg-white/80 shadow-inner" />
                  <p className="relative z-10 max-w-sm text-center">
                    Bring your own dashboard capture or campaign artwork to slot directly into this spotlight frame.
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
