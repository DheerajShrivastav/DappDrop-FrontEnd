import { siteOrigin } from '@/config/landing'

/**
 * 07-wow: per-page structured data for the subpages: a WebPage (part of the site's WebSite,
 * src/components/landing/json-ld.tsx) with its BreadcrumbList. No FAQPage: the answers are
 * flag-dependent JSX and must not drift from what's rendered.
 */
export function PageJsonLd({ path, name, description }: { path: string; name: string; description: string }) {
  const url = `${siteOrigin}${path}`
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name,
        description,
        isPartOf: { '@id': `${siteOrigin}/#website` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'DappDrop', item: `${siteOrigin}/` },
          { '@type': 'ListItem', position: 2, name, item: url },
        ],
      },
    ],
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}
