import { officialLinks, siteOrigin } from '@/config/landing'

/**
 * S1-15: Organization + WebSite structured data. `sameAs` only lists handles the founder has
 * confirmed (C3); with none confirmed it's omitted.
 */
export function JsonLd() {
  const org: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${siteOrigin}/#organization`,
    name: 'DappDrop',
    url: `${siteOrigin}/`,
    logo: `${siteOrigin}/apple-icon.png`,
  }
  if (officialLinks.length) org.sameAs = officialLinks.map((l) => l.url)
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      org,
      { '@type': 'WebSite', '@id': `${siteOrigin}/#website`, name: 'DappDrop', url: `${siteOrigin}/`, publisher: { '@id': `${siteOrigin}/#organization` } },
    ],
  }
  // JSON in a non-executable script type; escape "<" so nothing can close the tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}
