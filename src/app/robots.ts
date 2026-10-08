import type { MetadataRoute } from 'next'
import { siteOrigin } from '@/config/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/dashboard', '/humanity-callback'] }],
    sitemap: `${siteOrigin}/sitemap.xml`,
    host: siteOrigin,
  }
}
