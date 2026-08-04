import { createHash } from 'node:crypto'

/**
 * The duplicate-detection hash for a testimony body.
 *
 * Trim, lower-case, collapse whitespace, SHA-256, hex. This mirrors — and must
 * keep mirroring — the SQL expression the backfill migration used:
 *
 *   encode(digest(trim(regexp_replace(lower(body), '\s+', ' ', 'g')), 'sha256'), 'hex')
 *
 * Two submissions with the same hash are the same words however the author
 * re-typed the spacing, which turns "is this a duplicate?" from an opinion
 * into a lookup.
 */
export function testimonyBodyHash(body: string): string {
  const normalised = body.toLowerCase().replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(normalised, 'utf8').digest('hex')
}

/**
 * The same rule under a content-neutral name — contact messages use it too,
 * and one implementation is the point: a "duplicate" must mean the same thing
 * wherever the word appears in the admin.
 */
export const normalisedBodyHash = testimonyBodyHash
