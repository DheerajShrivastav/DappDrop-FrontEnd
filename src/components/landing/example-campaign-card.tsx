/**
 * AS-4: an illustrative campaign card in one lifecycle state. Status colours mean lifecycle
 * only (the app's status tokens) and always come with the word. "Example · {network}" is
 * printed on every card, so nothing reads as traction.
 */
type State = 'open' | 'claimable' | 'closed'

const LABEL: Record<State, string> = { open: 'Open', claimable: 'Claims open', closed: 'Closed' }
const DOT: Record<State, string> = {
  open: 'bg-status-open-solid',
  claimable: 'bg-status-claimable-solid',
  closed: 'bg-status-closed-solid',
}
const CHIP: Record<State, string> = {
  open: 'border-status-open-border bg-status-open-bg text-status-open-fg',
  claimable: 'border-status-claimable-border bg-status-claimable-bg text-status-claimable-fg',
  closed: 'border-status-closed-border bg-status-closed-bg text-status-closed-fg',
}

export function ExampleCampaignCard({ state, title, lines, tag, className = '' }: { state: State; title: string; lines: string[]; tag: string; className?: string }) {
  return (
    <article className={`rounded-lg border border-rule bg-surface p-4 ${className}`} aria-label={`Example campaign card: ${LABEL[state]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.75rem] font-medium ${CHIP[state]}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[state]}`} />
          {LABEL[state]}
        </span>
        <span className="font-mono text-[0.6875rem] uppercase text-ink-3">{tag}</span>
      </div>
      <h3 className="mt-3 text-body font-semibold">{title}</h3>
      <ul className="mt-1.5 space-y-0.5 text-small text-ink-2">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </article>
  )
}
