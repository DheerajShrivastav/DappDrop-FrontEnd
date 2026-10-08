/**
 * The typeset wordmark (VIS-10): "DappDrop" in Newsreader, solid ink. No logo tile, no gradient.
 * A new mark is a separate founder decision (BB-05).
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-display text-[1.375rem] sm:text-[1.625rem] leading-none tracking-[-0.02em] ${className}`}>DappDrop</span>
}
