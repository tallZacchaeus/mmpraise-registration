import type { MetadataRoute } from 'next'
import { siteConfig } from '@/config/site'

/**
 * Crawler rules.
 *
 * The public marketing pages are indexable; anything behind authentication, the
 * API and the file-delivery route are not — they hold volunteer data and would
 * be pointless in an index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/dashboard', '/apply', '/api/', '/login', '/register', '/reset-password', '/verify-email'],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  }
}
