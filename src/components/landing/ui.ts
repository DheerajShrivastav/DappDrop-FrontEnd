/**
 * Shared class strings for the landing page (server-safe, no React). Filled buttons carry
 * `border border-transparent` so they keep an edge in forced-colours mode (QW-05).
 */
const base =
  'inline-flex items-center justify-center gap-2 rounded-sm border font-semibold leading-none transition-colors duration-[var(--dur-micro)] active:translate-y-px'

/** Filled ink button on paper: the one host action per screen. 48 px tall. */
export const primaryButton = `${base} h-12 px-5 text-body border-transparent bg-ink text-paper can-hover:hover:bg-black`

/** Smaller filled button for the header (44 px, the touch-target floor). */
export const headerButton = `${base} h-11 px-4 text-small border-transparent bg-ink text-paper can-hover:hover:bg-black`

/** Secondary: transparent with a rule-strong border. */
export const secondaryButton = `${base} h-11 px-4 text-small border-rule-strong bg-transparent text-ink can-hover:hover:border-ink`

/** Mono eyebrow label. */
export const eyebrow = 'font-mono text-eyebrow uppercase font-medium text-ink-3'
