import { claims } from '@/config/claims'
import { repos } from '@/config/landing'

/**
 * 07-wow IA §4: page navigation (≤ 4 items + the CTA). Plain <a> everywhere in the marketing
 * chrome: nothing is prefetched, and next/link's client chunk stays off the landing pages.
 */
export const START_HREF = '/create-campaign'

/** Item 4: "Browse campaigns" once /campaigns is curated (C11); until then "For participants". */
export const participantsLink = claims.campaignsCurated
  ? { label: 'Browse campaigns', href: '/campaigns' }
  : { label: 'For participants', href: '/how-it-works#participants' }

export const NAV_LINKS = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Security', href: '/security' },
  { label: 'FAQ', href: '/how-it-works#faq' },
  participantsLink,
] as const

/** Extra links in the phone menu only. */
export const MENU_EXTRA_LINKS = [
  { label: 'About', href: '/about', external: false },
  { label: 'Changelog', href: '/changelog', external: false },
  { label: 'GitHub', href: repos.app, external: true },
] as const
