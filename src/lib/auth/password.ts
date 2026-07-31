import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/** Promisified scrypt. Typed explicitly because promisify loses the options overload. */
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

/**
 * Password hashing using scrypt from Node's standard library.
 *
 * scrypt is a memory-hard KDF recommended by OWASP and NIST SP 800-63B. It is
 * used here in preference to bcrypt/argon2 bindings because it needs no native
 * compilation step, which removes a common source of deployment breakage while
 * remaining a first-class choice for password storage.
 *
 * Parameters follow the OWASP minimum for scrypt (N=2^15, r=8, p=1). The cost
 * parameters are encoded in the stored string so they can be raised later and
 * existing hashes upgraded transparently on next successful login.
 *
 * Stored format: scrypt$N$r$p$<salt-b64url>$<hash-b64url>
 */
const N = 32768
const R = 8
const P = 1
const KEY_LENGTH = 64
const SALT_LENGTH = 16
// scrypt needs roughly 128 * N * r bytes; give it headroom above the 32 MB default.
const MAX_MEM = 128 * N * R * 2

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  })

  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, nRaw, rRaw, pRaw, saltRaw, hashRaw] = stored.split('$')
    if (scheme !== 'scrypt' || !saltRaw || !hashRaw) return false

    const salt = Buffer.from(saltRaw, 'base64url')
    const expected = Buffer.from(hashRaw, 'base64url')
    const n = Number(nRaw)
    const r = Number(rRaw)
    const p = Number(pRaw)
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false

    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 128 * n * r * 2,
    })

    // Lengths are equal by construction; timingSafeEqual still guards the compare.
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

/** True when a stored hash uses weaker parameters than the current policy. */
export function needsRehash(stored: string): boolean {
  const [scheme, nRaw, rRaw, pRaw] = stored.split('$')
  if (scheme !== 'scrypt') return true
  return Number(nRaw) < N || Number(rRaw) < R || Number(pRaw) < P
}
