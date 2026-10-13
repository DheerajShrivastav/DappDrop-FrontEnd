/**
 * Shared class strings for the landing pages (server-safe, no React). Filled buttons carry
 * `border border-transparent` so they keep an edge in forced-colours mode (QW-05). Colours are
 * tokens, so every button follows the Obsidian / Porcelain themes.
 */
const base =
  'inline-flex items-center justify-center gap-2 rounded-sm border font-semibold leading-none transition-colors [transition-duration:var(--dur-micro)] active:translate-y-px'

/** Filled ink button: the one host action per screen. 48 px tall. */
export const primaryButton = `${base} h-12 px-5 text-body border-transparent bg-ink text-paper can-hover:hover:bg-ink-2`

/** 07-wow: the Monolith pill (prototype .btn), filled. 48 px tall. */
export const pillButton =
  'inline-flex h-12 items-center justify-center rounded-full border border-transparent bg-ink px-6 text-body font-medium leading-none text-paper transition-colors [transition-duration:var(--dur-micro)] can-hover:hover:bg-ink-2 active:translate-y-px'

/** 07-wow: the header's outline pill (prototype .nav-cta). 44 px, the touch-target floor. */
export const headerButton =
  'inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-rule-strong px-3 text-small font-medium leading-none text-ink transition-colors [transition-duration:var(--dur-micro)] can-hover:hover:border-ink sm:px-4 active:translate-y-px'

/** Secondary: transparent with a rule-strong border. */
export const secondaryButton = `${base} h-11 px-4 text-small border-rule-strong bg-transparent text-ink can-hover:hover:border-ink`

/** Mono eyebrow label. */
export const eyebrow = 'font-mono text-eyebrow uppercase font-medium text-ink-3'

/** 07-wow: the pill on the ink band (inverted: paper fill, ink text). */
export const pillButtonOnBand =
  'inline-flex h-12 items-center justify-center rounded-full border border-transparent bg-paper px-6 text-body font-medium leading-none text-ink transition-colors [transition-duration:var(--dur-micro)] can-hover:hover:bg-paper-2 active:translate-y-px'
