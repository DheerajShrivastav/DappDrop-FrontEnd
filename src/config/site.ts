/**
 * Site identity constants with NO imports, so next.config.ts can read them too.
 * Re-exported by ./landing.ts, where the founder placeholders live.
 */

/**
 * TODO(founder): decision D9 (brand domain). Default: the current custom domain. Drives the
 * canonical URL, metadataBase, the sitemap, the anti-phishing line and the redirect below.
 */
export const officialDomain = 'dapp-drop.dheerajshrivastav.me'
export const siteOrigin = `https://${officialDomain}`

/** Hosts that 308-redirect to the official domain (QW-04). */
export const redirectHosts = ['dapp-drop.vercel.app']

export const repos = {
  app: 'https://github.com/DheerajShrivastav/DappDrop-FrontEnd',
  contracts: 'https://github.com/DheerajShrivastav/Dapp-Drop-Smart-Contract',
} as const
