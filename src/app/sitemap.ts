import type { MetadataRoute } from 'next'
import { siteOrigin } from '@/config/site'

// Public, indexable pages only. App routes that need a wallet stay out.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteOrigin}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteOrigin}/campaigns`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${siteOrigin}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteOrigin}/changelog`, changeFrequency: 'weekly', priority: 0.4 },
  ]
}
