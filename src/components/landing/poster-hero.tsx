import type { ReactNode } from 'react'

/**
 * Refine pass (landing-studio/08-site/refine): the subpage hero in the home page's composition.
 * The copy sits left (~40 %), the escrow vault right; on phones the copy is on top and the vault
 * in the bottom half (the home page's phone layout). The vault is the 3D build's own designed
 * still (public/landing/vault, 4–9 KB AVIF per theme), so the subpages share the home page's one
 * image without loading any 3D: no JS, a server component.
 *
 * Motion is CSS only (globals.css, `.lp-stage*`): the still settles in once, then drifts and dims
 * as the hero scrolls away. Nothing moves under reduced motion. The art is aria-hidden and never
 * the LCP (the H1 is): the images are lazy and low priority, and only the current theme's
 * picture is displayed, so only it downloads.
 */
const POSTER = '/landing/vault'

function Poster({ theme }: { theme: 'obsidian' | 'porcelain' }) {
  return (
    <picture className={`lp-stage-poster lp-stage-poster--${theme}`}>
      <source media="(max-width: 767.98px)" srcSet={`${POSTER}/${theme}-portrait.avif`} type="image/avif" />
      <img src={`${POSTER}/${theme}-landscape.avif`} alt="" width={1440} height={900} loading="lazy" decoding="async" fetchPriority="low" />
    </picture>
  )
}

export function PosterHero({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section aria-labelledby="hero-title" data-section="hero" className="lp-stage">
      <div className="lp-stage-art" aria-hidden="true">
        <div className="lp-stage-settle">
          <Poster theme="obsidian" />
          <Poster theme="porcelain" />
        </div>
      </div>
      <div className="lp-container lp-stage-copy">
        <div className="max-w-[42rem]">
          <p className="mh-eyebrow text-ink-3">{eyebrow}</p>
          <h1 id="hero-title" className="mh-display lp-stage-h1 mt-5 text-ink md:mt-7">
            {title}
          </h1>
          {lead && <p className="mh-sub mt-5 text-ink-2 md:mt-7">{lead}</p>}
          {children}
        </div>
      </div>
    </section>
  )
}
