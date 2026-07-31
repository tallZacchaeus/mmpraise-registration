import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { env, isProduction } from '@/lib/env'

/**
 * CSRF protection.
 *
 * Two independent defences:
 *  1. Origin/Host check — rejects cross-site requests outright. Next.js applies
 *     this to Server Actions itself; this helper extends it to Route Handlers.
 *  2. Signed double-submit token — a cookie readable by same-origin JavaScript
 *     that must be echoed back in the `x-csrf-token` header. The token is HMAC'd
 *     with APP_SECRET so it cannot be forged by a subdomain that can write cookies.
 */
const CSRF_COOKIE = 'mmp_csrf'
const CSRF_HEADER = 'x-csrf-token'

function sign(value: string): string {
  return createHmac('sha256', env.APP_SECRET).update(value).digest('base64url')
}

function build(): string {
  const nonce = randomBytes(24).toString('base64url')
  return `${nonce}.${sign(nonce)}`
}

function isValidToken(token: string | undefined | null): boolean {
  if (!token) return false
  const [nonce, signature] = token.split('.')
  if (!nonce || !signature) return false
  const expected = Buffer.from(sign(nonce))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length) return false
  return timingSafeEqual(expected, provided)
}

/** Read the current CSRF token, minting one if the visitor does not have it yet. */
export async function ensureCsrfToken(): Promise<string> {
  const jar = await cookies()
  const existing = jar.get(CSRF_COOKIE)?.value
  if (isValidToken(existing)) return existing!

  const token = build()
  jar.set(CSRF_COOKIE, token, {
    httpOnly: false, // read by client code to populate the request header
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return token
}

/** Verify a mutating Route Handler request. Returns null when valid, else a reason. */
export async function verifyCsrf(request: Request): Promise<string | null> {
  const method = request.method.toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null

  const headerList = await headers()
  const origin = headerList.get('origin')
  if (origin) {
    const allowed = new URL(env.APP_URL).origin
    if (origin !== allowed) return 'origin_mismatch'
  }

  const jar = await cookies()
  const cookieToken = jar.get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_HEADER)

  if (!isValidToken(cookieToken)) return 'missing_csrf_cookie'
  if (!headerToken) return 'missing_csrf_header'

  const a = Buffer.from(cookieToken!)
  const b = Buffer.from(headerToken)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'csrf_mismatch'

  return null
}

export const CSRF_COOKIE_NAME = CSRF_COOKIE
export const CSRF_HEADER_NAME = CSRF_HEADER
