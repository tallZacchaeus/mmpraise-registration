import { links } from '@/config/site'

/**
 * Site navigation.
 *
 * Mirrors the current WordPress menu (Home, About, Resources▾, Share▾, Contact,
 * Give, Volunteer) so nothing is lost. Items whose destination is still a "#"
 * on the live site are marked `comingSoon` and render as plain text rather than
 * dead links — see docs/HOMEPAGE-AUDIT.md.
 */
export type NavItem = {
  label: string
  href: string | null
  description?: string
  comingSoon?: boolean
  children?: NavItem[]
}

/**
 * `comingSoon` is derived from the destination rather than hand-set: a link is
 * "coming soon" exactly when its feature flag has not been switched on yet, so
 * the two can never disagree. Parent items with `children` are pure containers
 * and are not marked.
 */
function leaf(label: string, href: string | null, description?: string): NavItem {
  return { label, href, description, comingSoon: !href }
}

export const primaryNav: NavItem[] = [
  { label: 'Home', href: '/' },
  leaf('About', links.about, 'The story and mission of MMPraise'),
  {
    label: 'Resources',
    href: null,
    children: [
      leaf('Blog', links.blog, 'Stories and updates'),
      leaf('Gallery', links.gallery, 'Photos from past editions'),
      leaf('Magazine', links.magazine, 'Read the MMPraise magazine'),
      leaf('Radio', links.radio, 'Listen to MMPraise radio'),
    ],
  },
  {
    label: 'Share',
    href: null,
    children: [
      leaf('Prayer Request', links.prayerRequest, 'Send us a prayer request'),
      leaf('Share Your Testimony', '#share-testimony', 'Tell us what God has done'),
    ],
  },
  leaf('Contact', links.contact),
]

/**
 * Shown as buttons rather than links, on both desktop and mobile.
 * Entries whose feature is not live yet are omitted: a header call to action
 * that cannot be acted on is worse than no button at all.
 */
export const navActions = [
  { label: 'Give', href: links.donation, variant: 'secondary' as const },
  { label: 'Volunteer', href: links.volunteer, variant: 'primary' as const },
].filter((action): action is { label: string; href: string; variant: 'primary' | 'secondary' } =>
  Boolean(action.href),
)
