import localFont from 'next/font/local'

// S1-01: the landing page's two font files (31.7 KB together, measured by PRF).
// Licences: src/fonts/OFL-*.txt (SIL OFL 1.1). The body text uses the system stack (0 KB).
// Subsets made by the studio's PRF engineer with fonttools/pyftsubset from the fontsource 5.3.0
// packages (landing-studio/01-audits/PRF-data/phase2-measurements.md):
// - Newsreader pinned opsz 72 / wght 450, Latin-1 + punctuation: 19,460 bytes;
// - JetBrains Mono wght 400–500 (tnum, zero), Latin-1: 12,268 bytes.

/** Newsreader, pinned opsz 72 / wght 450: H1, H2, the wordmark. Preloaded (the H1 is the LCP). */
export const display = localFont({
  src: '../../fonts/newsreader-opsz72-wght450-latin1.woff2',
  variable: '--font-display',
  weight: '450',
  style: 'normal',
  display: 'swap',
  preload: true,
  // Metric-matched fallback, so the swap doesn't shift the 3-line H1 (CLS 0).
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
})

/** JetBrains Mono 400–500: figures, addresses, eyebrows, chips. Not preloaded; optional. */
export const mono = localFont({
  src: '../../fonts/jetbrains-mono-wght400-500-latin1.woff2',
  variable: '--font-mono',
  weight: '400 500',
  style: 'normal',
  display: 'optional',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
})
