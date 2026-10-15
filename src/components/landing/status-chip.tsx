/**
 * SM-3 status chips: the state is always in the words, never colour or shape alone (1.4.1).
 * - checked: solid border; - self: dashed border + "Self-reported"; - review: clock + text;
 * - planned: muted text. No pointer cursor, no hover lift (they aren't controls).
 */
export type ChipKind = 'checked' | 'self' | 'review' | 'planned'

export function StatusChip({ kind, children }: { kind: ChipKind; children: React.ReactNode }) {
  const cls =
    kind === 'checked'
      ? 'border-ink-2 text-ink'
      : kind === 'self'
        ? 'border-dashed border-ink-3 text-ink'
        : kind === 'review'
          ? 'border-ink-3 text-ink-2'
          : 'border-rule-strong text-ink-2'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border bg-surface px-2.5 py-0.5 font-mono text-[0.75rem] leading-5 ${cls}`}>
      {kind === 'checked' && <span aria-hidden="true">✓</span>}
      {kind === 'review' && <span aria-hidden="true">◷</span>}
      {children}
    </span>
  )
}
