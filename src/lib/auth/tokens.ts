import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Opaque bearer tokens for sessions, email verification and password resets.
 *
 * The raw token is sent to the user (cookie or email link) and only its SHA-256
 * digest is stored, so a database disclosure cannot be replayed to authenticate.
 * SHA-256 is appropriate here — unlike passwords these are 256-bit random values,
 * so there is nothing to brute-force.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

/** Constant-time comparison for two digests of equal length. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function expiresIn(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000)
}
