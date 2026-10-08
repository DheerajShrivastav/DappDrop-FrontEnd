/**
 * AS-3: a product frame for the #how replicas: presentational HTML, never the real wizard
 * (no imports from the app), always marked "Example". Decorative to assistive tech when
 * `hidden` (the step's heading and paragraph carry the meaning, A11-crit).
 */
export function Frame({ fig, caption, children }: { fig: number; caption: string; children: React.ReactNode }) {
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-lg border border-rule bg-surface shadow-e1">
        <div className="flex items-center justify-between border-b border-rule px-3 py-1.5 font-mono text-[0.6875rem] uppercase text-ink-3">
          <span>DappDrop</span>
          <span>Example</span>
        </div>
        <div className="p-3 text-[0.8125rem] text-ink sm:p-4">{children}</div>
      </div>
      <figcaption className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-ink-3">
        Fig. {fig} — {caption}
      </figcaption>
    </figure>
  )
}
