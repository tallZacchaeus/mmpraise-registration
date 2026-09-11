/**
 * Launch gating.
 *
 * For the first release only the homepage and the registration journey are
 * live. Everything else renders as "Coming soon" rather than linking to the old
 * WordPress site or to a page that does not exist yet.
 *
 * Each destination is a single flag, so switching one on is a one-line env
 * change and a redeploy — no code edit. Set the variable to "true" to enable.
 *
 *   NEXT_PUBLIC_FEATURE_GIVE=true
 *
 * The registration journey (register, login, apply, dashboard, password reset,
 * email verification), the administration area and the legal pages are always
 * on: registration cannot receive applications without them.
 */
function flag(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (value === undefined || value.trim() === '') return defaultValue
  return value.trim().toLowerCase() === 'true'
}

export type FeatureKey =
  | 'about'
  | 'blog'
  | 'gallery'
  | 'magazine'
  | 'radio'
  | 'prayerRequest'
  | 'contact'
  | 'give'
  | 'livestream'
  | 'shareTestimony'
  | 'newsletter'
  | 'attendingFrame'

export const features: Record<FeatureKey, boolean> = {
  // --- Live -----------------------------------------------------------------
  /** An existing, working YouTube channel — not something being rebuilt. */
  livestream: flag('NEXT_PUBLIC_FEATURE_LIVESTREAM', true),
  /** Both live on the homepage itself and moderated before anything publishes. */
  shareTestimony: flag('NEXT_PUBLIC_FEATURE_SHARE_TESTIMONY', true),
  newsletter: flag('NEXT_PUBLIC_FEATURE_NEWSLETTER', true),
  /**
   * The "I will be attending" share card. Built entirely in the browser — no
   * upload, no storage, nothing to moderate — so there is no operational
   * reason to hold it back, but it stays a flag like every other destination.
   */
  attendingFrame: flag('NEXT_PUBLIC_FEATURE_ATTENDING_FRAME', true),

  /** Built: /about is part of this application, not the old WordPress page. */
  about: flag('NEXT_PUBLIC_FEATURE_ABOUT', true),

  // --- Coming soon ----------------------------------------------------------
  blog: flag('NEXT_PUBLIC_FEATURE_BLOG', false),
  gallery: flag('NEXT_PUBLIC_FEATURE_GALLERY', false),
  magazine: flag('NEXT_PUBLIC_FEATURE_MAGAZINE', false),
  radio: flag('NEXT_PUBLIC_FEATURE_RADIO', false),
  prayerRequest: flag('NEXT_PUBLIC_FEATURE_PRAYER_REQUEST', false),
  /** Built: /contact is part of this application, not the old WordPress page. */
  contact: flag('NEXT_PUBLIC_FEATURE_CONTACT', true),
  /**
   * Donations are switched off for the first release on the client's
   * instruction. The destination still works on the current site, so this is
   * the single flag to flip when they are ready to accept giving again.
   */
  give: flag('NEXT_PUBLIC_FEATURE_GIVE', false),
}

/** A destination, or null when the feature is not live yet. */
export function destination(key: FeatureKey, href: string | null): string | null {
  return features[key] && href ? href : null
}

export function isEnabled(key: FeatureKey): boolean {
  return features[key]
}
