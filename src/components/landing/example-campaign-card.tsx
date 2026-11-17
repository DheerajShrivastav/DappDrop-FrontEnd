/**
 * AS-4: an illustrative campaign card in one lifecycle state, and always with the word.
 * "Example · {network}" is printed on every card, so nothing reads as traction.
 *
 * Refine pass: it mirrors the real app card (src/components/app/chip-map.ts) instead of the
 * retired light status palette: Open is an ink outline with ●, Claims open the one gold fill
 * (the reward), Closed a quiet outline; the title is serif, like /campaigns. Landing tokens only
 * (no app imports on the marketing pages).
 */
type State = 'open' | 'claimable' | 'closed'

const LABEL: Record<State, string> = { open: 'Open', claimable: 'Claims open', closed: 'Closed' }
const CHIP: Record<State, string> = {
  open: 'border-ink-2 text-ink',
  claimable: 'border-signal bg-signal font-medium text-paper',
  closed: 'border-rule-strong text-ink-3',
}

export function ExampleCampaignCard({ state, title, lines, tag, className = '' }: { state: State; title: string; lines: string[]; tag: string; className?: string }) {
  return (
    <article className={`rounded-[10px] border border-rule bg-surface p-5 ${className}`} aria-label={`Example campaign card: ${LABEL[state]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.75rem] leading-5 ${CHIP[state]}`}>
          {state === 'open' && <span aria-hidden="true">●</span>}
          {LABEL[state]}
        </span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-3">{tag}</span>
      </div>
      <h3 className="mh-display mt-3 text-[1.375rem] leading-tight text-ink">{title}</h3>
      <ul className="mt-2 space-y-0.5 text-small text-ink-2">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </article>
  )
}
