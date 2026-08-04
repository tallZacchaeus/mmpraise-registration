import type { MetadataRoute } from 'next'
import { links, siteConfig } from '@/config/site'

/**
 * Sitemap for the publicly indexable pages only.
 * Authenticated routes are excluded here and in robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    { url: siteConfig.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    // Listed only while the About launch flag is on; a 404 in the sitemap is
    // worse than an absent entry.
    ...(links.about === '/about'
      ? [
          {
            url: `${siteConfig.url}/about`,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.8,
          },
        ]
      : []),
    ...(links.contact === '/contact'
      ? [
          {
            url: `${siteConfig.url}/contact`,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.7,
          },
        ]
      : []),
    { url: `${siteConfig.url}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteConfig.url}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
