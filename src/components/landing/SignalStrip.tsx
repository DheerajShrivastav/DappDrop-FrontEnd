export default function SignalStrip() {
  const signals = [
    'Campaign playbooks',
    'Wallet-native verification',
    'Audience telemetry',
    'Reward logistics',
    'Sybil defenses',
    'Operator tools',
  ]

  return (
    <section className="relative overflow-hidden px-6 py-12">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-sky-200/40 via-white to-indigo-200/40" aria-hidden />
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
        {signals.map((signal) => (
          <span
            key={signal}
            className="inline-flex items-center gap-3 rounded-full border border-slate-300/70 bg-white/80 px-5 py-2 shadow-sm backdrop-blur"
          >
            <span className="size-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" />
            {signal}
          </span>
        ))}
      </div>
    </section>
  )
}
