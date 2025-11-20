const testimonials = [
  {
    quote:
      'We replaced a mess of spreadsheets and Discord forms with a single quest that actually felt built for our collectors. The analytics slide went straight into our board call.',
    name: 'Zenia Park',
    role: 'Community Lead, Solstice Labs',
  },
  {
    quote:
      'DAppDrop let us prove every contributor was a real human without slowing down reward fulfillment. Our ops team finally slept during launch week.',
    name: 'Omar Bello',
    role: 'Ops, Beacon Guild',
  },
]

export default function Testimonials() {
  return (
    <section className="px-6 pb-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <span className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 shadow-sm">
            Voices from the field
          </span>
          <h2 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.5rem]">
            Operators who switched to DAppDrop stopped debating whether their growth was real.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {testimonials.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="rounded-3xl border border-white/60 bg-white/80 p-8 text-left shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <blockquote className="text-sm leading-relaxed text-slate-600">
                "{testimonial.quote}"
              </blockquote>
              <figcaption className="mt-6 text-sm font-semibold text-slate-900">
                {testimonial.name}
                <span className="mt-1 block text-xs font-normal uppercase tracking-[0.25em] text-slate-500">
                  {testimonial.role}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
