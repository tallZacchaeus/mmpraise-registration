import type { MetadataRoute } from 'next'
import { siteConfig } from '@/config/site'

/**
 * Sitemap for the publicly indexable pages only.
 * Authenticated routes are excluded here and in robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    { url: siteConfig.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteConfig.url}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteConfig.url}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
