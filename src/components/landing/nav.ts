import { claims } from '@/config/claims'
import { repos } from '@/config/landing'

/**
 * The landing page's in-page anchors (plan §2.0). Hrefs are "/#id" so the same header works on
 * /about and /changelog; on / they're same-document jumps (no navigation, nothing prefetched).
 */
export const SECTION_LINKS = [
  { label: 'How the money moves', href: '/#payouts' },
  { label: 'How it works', href: '/#how' },
  { label: 'Security', href: '/#security' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
] as const

/** "Browse campaigns" stays on the page until /campaigns is curated (D-X1, C11). */
export const browseCampaigns = claims.campaignsCurated
  ? { label: 'Browse campaigns', href: '/campaigns' }
  : { label: 'Browse campaigns', href: '/#participants' }

export const START_HREF = '/#start'

/** Extra links in the phone menu only. */
export const MENU_EXTRA_LINKS = [
  { label: 'About', href: '/about', external: false },
  { label: 'Changelog', href: '/changelog', external: false },
  { label: 'GitHub', href: repos.app, external: true },
] as const
