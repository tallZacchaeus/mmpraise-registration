import { destination } from './features'

/**
 * Single source of truth for event facts and external destinations.
 *
 * Everything here is either read from an environment variable or carries a
 * documented default, so the organisation can change dates, venues and URLs
 * without a code change. Values marked TODO(verify) were inconsistent on the
 * current WordPress homepage and need confirmation — see docs/HOMEPAGE-AUDIT.md.
 *
 * Client Components read this too, so it must not import anything server-only.
 */

function env(key: string, fallback: string): string {
  const value = process.env[key]
  return value && value.trim().length > 0 ? value.trim() : fallback
}

function optionalEnv(key: string): string | null {
  const value = process.env[key]
  return value && value.trim().length > 0 ? value.trim() : null
}

export const siteConfig = {
  name: 'Marathon Messiah’s Praise',
  shortName: 'MMPraise',
  url: env('NEXT_PUBLIC_SITE_URL', 'https://mmpraise.org'),
  description:
    'Marathon Messiah’s Praise is an annual global gospel event where worshippers from many nations gather to praise God without stopping. Attend in person, watch online, volunteer or give.',
  locale: 'en_NG',
} as const

export const eventConfig = {
  /**
   * The duration increases by one hour each year: the 2026 edition ran for 84
   * hours, so 2027 is 85.
   */
  durationHours: Number(env('NEXT_PUBLIC_EVENT_DURATION_HOURS', '85')),

  edition: env('NEXT_PUBLIC_EVENT_EDITION', '2027'),

  /**
   * ISO 8601 with timezone, or null while the date is still to be announced.
   *
   * The 2027 date is not yet confirmed, so this is intentionally unset: the
   * countdown, the event facts and the structured data all switch to a
   * "date to be announced" state rather than showing a date nobody has agreed.
   * Set NEXT_PUBLIC_EVENT_STARTS_AT once it is confirmed and every one of those
   * places updates automatically.
   */
  startsAt: optionalEnv('NEXT_PUBLIC_EVENT_STARTS_AT'),

  /** Derived from startsAt + durationHours unless overridden. */
  endsAtOverride: optionalEnv('NEXT_PUBLIC_EVENT_ENDS_AT'),

  venue: {
    name: env('NEXT_PUBLIC_EVENT_VENUE', 'RCCG Prayer Foyer, New Arena'),
    address: env('NEXT_PUBLIC_EVENT_VENUE_ADDRESS', '3km by 3km, Redemption City, Nigeria'),
    mapUrl: env(
      'NEXT_PUBLIC_EVENT_MAP_URL',
      'https://maps.google.com/?q=RCCG+Redemption+City+Prayer+Foyer',
    ),
  },

  admission: 'Free and open to everyone',

  /** TODO(verify): prose says 82 nations; the map graphic still reads "80 Countries". */
  nationsCount: Number(env('NEXT_PUBLIC_EVENT_NATIONS', '82')),

  /** TODO(verify): no theme was published on the current homepage. */
  theme: optionalEnv('NEXT_PUBLIC_EVENT_THEME'),

  foundedYear: 2012,
  foundedNote:
    'Birthed on 2 March 2012 to celebrate God’s faithfulness in the life of Pastor E. A. Adeboye, General Overseer of the Redeemed Christian Church of God.',
} as const

/**
 * Destinations.
 *
 * Registration and volunteering point at this application's own routes so the
 * two systems behave as one product; they are always live.
 *
 * Everything else is wrapped in `destination(...)`, which returns null while
 * that feature is still being built — see src/config/features.ts. A null here
 * is rendered as "Coming soon" rather than as a dead link.
 */
export const links = {
  // Always live: registration cannot receive applications without these.
  register: env('NEXT_PUBLIC_REGISTRATION_URL', '/register'),
  volunteer: env('NEXT_PUBLIC_VOLUNTEER_URL', '/register'),
  shareTestimony: '/#share-testimony',

  // Gated behind launch flags.
  donation: destination('give', env('NEXT_PUBLIC_DONATION_URL', 'https://mmpraise.org/donate/')),
  livestream: destination(
    'livestream',
    env('NEXT_PUBLIC_LIVESTREAM_URL', 'https://www.youtube.com/@themmpraise'),
  ),
  youtube: destination('livestream', env('NEXT_PUBLIC_YOUTUBE_URL', 'https://www.youtube.com/@themmpraise')),
  radio: destination('radio', optionalEnv('NEXT_PUBLIC_RADIO_URL')),
  magazine: destination('magazine', optionalEnv('NEXT_PUBLIC_MAGAZINE_URL')),
  about: destination('about', env('NEXT_PUBLIC_ABOUT_URL', 'https://mmpraise.org/about-us/')),
  blog: destination('blog', env('NEXT_PUBLIC_BLOG_URL', 'https://mmpraise.org/blog/')),
  gallery: destination('gallery', env('NEXT_PUBLIC_GALLERY_URL', 'https://mmpraise.org/gallery/')),
  prayerRequest: destination(
    'prayerRequest',
    env('NEXT_PUBLIC_PRAYER_REQUEST_URL', 'https://mmpraise.org/prayer-request/'),
  ),
  contact: destination('contact', env('NEXT_PUBLIC_CONTACT_URL', 'https://mmpraise.org/contact-us/')),
} as const

export const contact = {
  email: env('NEXT_PUBLIC_CONTACT_EMAIL', 'info@mmpraise.org'),
  /**
   * Rendered only when set. The current site publishes the literal placeholder
   * "+234 XXX-XXXX-XXX", which is not carried over.
   */
  phone: optionalEnv('NEXT_PUBLIC_CONTACT_PHONE'),
  address: env('NEXT_PUBLIC_CONTACT_ADDRESS', 'Marathon Messiah’s Praise HQ, Lagos, Nigeria'),
  addressMapUrl:
    'https://maps.google.com/?q=Marathon+Messiah%27s+Praise+HQ,+Lagos,+Nigeria',
} as const

/**
 * Social profiles. The current footer lists these networks as plain text with no
 * links at all, so only YouTube is confirmed. The rest render only once a URL is
 * supplied — no dead icons.
 */
export const socialLinks = [
  { label: 'YouTube', href: links.youtube, handle: '@themmpraise' as string | null },
  { label: 'Facebook', href: optionalEnv('NEXT_PUBLIC_FACEBOOK_URL'), handle: null },
  { label: 'Instagram', href: optionalEnv('NEXT_PUBLIC_INSTAGRAM_URL'), handle: null },
  { label: 'X', href: optionalEnv('NEXT_PUBLIC_X_URL'), handle: null },
  { label: 'TikTok', href: optionalEnv('NEXT_PUBLIC_TIKTOK_URL'), handle: null },
].filter((social): social is { label: string; href: string; handle: string | null } =>
  Boolean(social.href),
)

/** True once a start date has been confirmed and configured. */
export function isEventScheduled(): boolean {
  if (!eventConfig.startsAt) return false
  return !Number.isNaN(new Date(eventConfig.startsAt).getTime())
}

/** Confirmed start, or null while the date is still to be announced. */
export function eventStartsAt(): Date | null {
  if (!isEventScheduled()) return null
  return new Date(eventConfig.startsAt!)
}

/** Absolute end of the event, used by the countdown's completed state. */
export function eventEndsAt(): Date | null {
  if (eventConfig.endsAtOverride) return new Date(eventConfig.endsAtOverride)
  const start = eventStartsAt()
  if (!start) return null
  return new Date(start.getTime() + eventConfig.durationHours * 3_600_000)
}

/** True when a URL leaves this application. */
export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}
