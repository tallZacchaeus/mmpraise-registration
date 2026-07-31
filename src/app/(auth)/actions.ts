'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { audit } from '@/lib/audit'
import { hashPassword, needsRehash, verifyPassword } from '@/lib/auth/password'
import { createSession, destroyAllSessions, destroySession, getSessionUser, pruneSessions } from '@/lib/auth/session'
import { expiresIn, generateToken, hashToken } from '@/lib/auth/tokens'
import { identifierKey, ipKey, rateLimit } from '@/lib/security/rate-limit'
import { sendMailSafely } from '@/lib/mail/mailer'
import { passwordResetEmail, verificationEmail } from '@/lib/mail/templates'
import { suggestUsername } from '@/lib/validation/common'
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validation/auth'
import { fail, ok, parseOrFail, type ActionResult } from '@/lib/actions/result'
import { getSettings } from '@/lib/settings'

/**
 * Authentication Server Actions.
 *
 * Next.js protects Server Actions against cross-origin invocation, so these do
 * not need the double-submit CSRF token that Route Handlers use. Rate limiting
 * is applied per IP *and* per identifier so one attacker cannot lock out a user
 * by hammering their address from many addresses, and vice versa.
 */

const VERIFICATION_TTL_MINUTES = 60 * 24
const RESET_TTL_MINUTES = 60
const MAX_FAILED_LOGINS = 10
const LOCKOUT_MINUTES = 15

/** Find a free username derived from the requested one. */
async function ensureUniqueUsername(requested: string, firstName: string, lastName: string): Promise<string> {
  const candidates = [requested]
  const base = suggestUsername(firstName, lastName)
  for (let i = 1; i <= 200; i++) candidates.push(`${base}${i}`)

  for (const candidate of candidates) {
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } })
    if (!taken) return candidate
  }
  return `${base}${Date.now().toString(36)}`.slice(0, 30)
}

async function issueVerificationEmail(userId: string, email: string, name: string) {
  // Only one live verification token per user.
  await db.verificationToken.updateMany({
    where: { userId, type: 'EMAIL_VERIFICATION', usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = generateToken()
  await db.verificationToken.create({
    data: {
      userId,
      type: 'EMAIL_VERIFICATION',
      tokenHash: hashToken(token),
      expiresAt: expiresIn(VERIFICATION_TTL_MINUTES),
    },
  })

  const url = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`
  const message = verificationEmail({ name, url })
  await sendMailSafely({ ...message, to: email })
}

// --- Sign up --------------------------------------------------------------

export async function signUpAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const settings = await getSettings()
  if (!settings.registration_open) {
    return fail(settings.registration_closed_message, undefined, 'registration_closed')
  }

  const limit = await rateLimit(await ipKey('signup'), env.RATE_LIMIT_REGISTER_MAX, env.RATE_LIMIT_REGISTER_WINDOW_MIN)
  if (!limit.allowed) {
    return fail(
      `Too many registration attempts. Please try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
      undefined,
      'rate_limited',
    )
  }

  const parsed = parseOrFail(signUpSchema, input)
  if (!parsed.ok) return parsed.result
  const { firstName, lastName, email, username, password } = parsed.data

  const existingEmail = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existingEmail) {
    return fail('An account with this email address already exists', {
      email: 'This email address is already registered. Try signing in instead.',
    })
  }

  const existingUsername = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (existingUsername) {
    const suggestion = await ensureUniqueUsername(username, firstName, lastName)
    return fail('That username is taken', { username: `That username is taken. "${suggestion}" is available.` })
  }

  const user = await db.user.create({
    data: {
      email,
      username,
      passwordHash: await hashPassword(password),
      roles: { create: [{ role: 'VOLUNTEER' }] },
      profile: { create: { firstName, lastName } },
    },
  })

  await issueVerificationEmail(user.id, email, firstName)
  await createSession(user.id)
  await audit({ action: 'auth.register', entityType: 'User', entityId: user.id, actorId: user.id })

  return ok({ redirectTo: '/apply' })
}

// --- Sign in --------------------------------------------------------------

export async function signInAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = parseOrFail(signInSchema, input)
  if (!parsed.ok) return parsed.result
  const { identifier, password, redirectTo } = parsed.data

  const byIp = await rateLimit(await ipKey('signin'), env.RATE_LIMIT_LOGIN_MAX * 4, env.RATE_LIMIT_LOGIN_WINDOW_MIN)
  const byIdentifier = await rateLimit(
    identifierKey('signin', identifier),
    env.RATE_LIMIT_LOGIN_MAX,
    env.RATE_LIMIT_LOGIN_WINDOW_MIN,
  )

  if (!byIp.allowed || !byIdentifier.allowed) {
    const wait = Math.ceil(Math.max(byIp.retryAfterSeconds, byIdentifier.retryAfterSeconds) / 60)
    return fail(`Too many sign-in attempts. Please try again in ${wait} minute${wait === 1 ? '' : 's'}.`, undefined, 'rate_limited')
  }

  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    include: { profile: { select: { firstName: true } } },
  })

  // Identical response whether the account exists or the password is wrong, so
  // the form cannot be used to enumerate registered addresses.
  const genericFailure = fail('Incorrect email/username or password', undefined, 'invalid_credentials')

  if (!user) {
    await audit({ action: 'auth.login_failed', entityType: 'User', metadata: { identifier, reason: 'no_such_user' } })
    return genericFailure
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return fail(`This account is temporarily locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, undefined, 'locked')
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    const failures = user.failedLogins + 1
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failures,
        lockedUntil: failures >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    })
    await audit({ action: 'auth.login_failed', entityType: 'User', entityId: user.id, metadata: { failures } })
    return genericFailure
  }

  if (!user.isActive) {
    return fail('This account has been deactivated. Please contact the volunteer team.', undefined, 'inactive')
  }

  // Transparently upgrade the stored hash if the cost policy has been raised.
  const data: Record<string, unknown> = { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }
  if (needsRehash(user.passwordHash)) data.passwordHash = await hashPassword(password)
  await db.user.update({ where: { id: user.id }, data })

  await createSession(user.id)
  await pruneSessions()
  await audit({ action: 'auth.login', entityType: 'User', entityId: user.id, actorId: user.id })

  const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/dashboard'
  return ok({ redirectTo: safeRedirect })
}

export async function signOutAction(): Promise<void> {
  const user = await getSessionUser()
  await destroySession()
  if (user) await audit({ action: 'auth.logout', entityType: 'User', entityId: user.id, actorId: user.id })
  redirect('/login')
}

// --- Email verification ---------------------------------------------------

export async function verifyEmailAction(token: string): Promise<ActionResult<{ alreadyVerified: boolean }>> {
  if (!token) return fail('This verification link is not valid')

  const record = await db.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })

  if (!record || record.type !== 'EMAIL_VERIFICATION') {
    return fail('This verification link is not valid. Request a new one below.', undefined, 'invalid_token')
  }
  if (record.usedAt) {
    return record.user.emailVerifiedAt
      ? ok({ alreadyVerified: true })
      : fail('This verification link has already been used. Request a new one below.', undefined, 'used_token')
  }
  if (record.expiresAt < new Date()) {
    return fail('This verification link has expired. Request a new one below.', undefined, 'expired_token')
  }

  await db.$transaction([
    db.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
  ])

  await audit({ action: 'auth.email_verified', entityType: 'User', entityId: record.userId, actorId: record.userId })
  return ok({ alreadyVerified: false })
}

export async function resendVerificationAction(): Promise<ActionResult> {
  const user = await getSessionUser()
  if (!user) return fail('Please sign in first')
  if (user.emailVerified) return ok()

  const limit = await rateLimit(identifierKey('verify_resend', user.id), 3, 15)
  if (!limit.allowed) {
    return fail(`Please wait ${Math.ceil(limit.retryAfterSeconds / 60)} minutes before requesting another email.`)
  }

  await issueVerificationEmail(user.id, user.email, user.firstName ?? 'there')
  return ok()
}

// --- Password reset -------------------------------------------------------

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const parsed = parseOrFail(forgotPasswordSchema, input)
  if (!parsed.ok) return parsed.result
  const { email } = parsed.data

  const limit = await rateLimit(identifierKey('reset_request', email), 3, 30)
  const ipLimit = await rateLimit(await ipKey('reset_request'), 10, 30)

  // Always report success — the response must not reveal whether the address exists.
  if (!limit.allowed || !ipLimit.allowed) return ok()

  const user = await db.user.findUnique({ where: { email }, include: { profile: { select: { firstName: true } } } })
  if (!user) return ok()

  await db.verificationToken.updateMany({
    where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = generateToken()
  await db.verificationToken.create({
    data: {
      userId: user.id,
      type: 'PASSWORD_RESET',
      tokenHash: hashToken(token),
      expiresAt: expiresIn(RESET_TTL_MINUTES),
    },
  })

  const url = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`
  const message = passwordResetEmail({ name: user.profile?.firstName ?? 'there', url })
  await sendMailSafely({ ...message, to: user.email })
  await audit({ action: 'auth.password_reset_requested', entityType: 'User', entityId: user.id })

  return ok()
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = parseOrFail(resetPasswordSchema, input)
  if (!parsed.ok) return parsed.result
  const { token, password } = parsed.data

  const record = await db.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!record || record.type !== 'PASSWORD_RESET' || record.usedAt || record.expiresAt < new Date()) {
    return fail('This reset link is no longer valid. Request a new one.', undefined, 'invalid_token')
  }

  await db.$transaction([
    db.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null },
    }),
  ])

  // Any session opened with the old password is no longer trustworthy.
  await destroyAllSessions(record.userId)
  await audit({ action: 'auth.password_reset', entityType: 'User', entityId: record.userId })

  return ok()
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return fail('Please sign in first')

  const parsed = parseOrFail(changePasswordSchema, input)
  if (!parsed.ok) return parsed.result

  const user = await db.user.findUnique({ where: { id: sessionUser.id } })
  if (!user) return fail('Account not found')

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return fail('Your current password is incorrect', { currentPassword: 'Your current password is incorrect' })
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  })

  await audit({ action: 'auth.password_changed', entityType: 'User', entityId: user.id, actorId: user.id })
  return ok()
}
