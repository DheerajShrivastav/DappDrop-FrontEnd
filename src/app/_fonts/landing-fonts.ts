import localFont from 'next/font/local'

// S1-01: the landing page's two font files (42.9 KB together; budget 2 files, 60 KB).
// Licences: src/fonts/OFL-*.txt (SIL OFL 1.1). The body text uses the system stack (0 KB).
// Subsets made by the studio's PRF engineer with fonttools/pyftsubset from the fontsource 5.3.0
// packages (landing-studio/01-audits/PRF-data/phase2-measurements.md):
// - Newsreader opsz pinned 72, wght variable 300-340, Latin-1 + punctuation: 30,624 bytes
//   (07-wow QA: the Monolith design sets the display face at 300 in Obsidian and 340 in Porcelain;
//   it replaces the static wght 450 file, 19,460 bytes. Recipe, from @fontsource-variable/newsreader
//   5.3.0 files/newsreader-latin-opsz-normal.woff2, fonttools 4.60.1:
//     fonttools varLib.instancer <src> opsz=72 wght=300:340 -o nr.ttf
//     pyftsubset nr.ttf --unicodes=U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026
//       --layout-features=liga,tnum,kern --flavor=woff2);
// - JetBrains Mono wght 400–500 (tnum, zero), Latin-1: 12,268 bytes.

/** Newsreader, opsz 72 / wght 300-340: H1, H2, the wordmark. Preloaded (the H1 is the LCP). */
export const display = localFont({
  src: '../../fonts/newsreader-opsz72-wght300-340-latin1.woff2',
  variable: '--font-display',
  weight: '300 340',
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
