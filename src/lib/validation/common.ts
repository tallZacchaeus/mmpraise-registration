import { z } from 'zod'

/**
 * Validation primitives shared by the client and the server.
 *
 * Everything the browser validates is validated again on the server using these
 * exact schemas — the client copy is a convenience, never a trust boundary.
 */

// Control characters (C0 range plus DEL) are stripped from all user input.
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g
// Same, but keeps newline (\x0A) and tab (\x09) so multi-line answers survive.
const CONTROL_CHARS_KEEP_BREAKS = /[\x00-\x08\x0B-\x1F\x7F]/g
// Combining diacritical marks, removed when deriving a username from a name.
const DIACRITICS = /[̀-ͯ]/g

/** Collapse whitespace and strip control characters from free text. */
export function sanitiseText(value: string): string {
  return value.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim()
}

/** Preserve line breaks but still strip control characters. */
export function sanitiseMultiline(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_KEEP_BREAKS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const trimmedText = (max: number) =>
  z.string().transform(sanitiseText).pipe(z.string().max(max, `Must be ${max} characters or fewer`))

export const multilineText = (max: number) =>
  z.string().transform(sanitiseMultiline).pipe(z.string().max(max, `Must be ${max} characters or fewer`))

export const nameSchema = z
  .string()
  .transform(sanitiseText)
  .pipe(
    z
      .string()
      .min(2, 'Must be at least 2 characters')
      .max(60, 'Must be 60 characters or fewer')
      .regex(/^[\p{L}][\p{L}\p{M}'’\-. ]*$/u, 'Use letters, spaces, hyphens and apostrophes only'),
  )

export const emailSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.string().min(5, 'Email address is required').max(254).email('Enter a valid email address'))

/**
 * Phone numbers are stored in E.164 form (+ then 8–15 digits). The wizard's
 * country-code selector supplies the prefix, so users type only the local part.
 */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s()\-.]/g, ''))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid international phone number, e.g. +2348012345678'))

export function toE164(dialCode: string, localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '').replace(/^0+/, '')
  return `+${dialCode.replace(/\D/g, '')}${digits}`
}

export const urlSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().max(300).url('Enter a full link starting with http:// or https://'))
  .refine((v) => /^https?:\/\//i.test(v), 'Links must start with http:// or https://')

/** Usernames are case-insensitive and stored lower-case. */
export const usernameSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(4, 'Must be at least 4 characters')
      .max(30, 'Must be 30 characters or fewer')
      .regex(/^[a-z0-9._-]+$/, 'Use lowercase letters, numbers, dots, underscores and hyphens'),
  )

// --- Password policy ------------------------------------------------------

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v: string) => v.length >= 8, optional: false },
  { id: 'upper', label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v), optional: false },
  { id: 'lower', label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v), optional: false },
  { id: 'number', label: 'One number', test: (v: string) => /\d/.test(v), optional: false },
  {
    id: 'symbol',
    label: 'One special character (recommended)',
    test: (v: string) => /[^A-Za-z0-9]/.test(v),
    optional: true,
  },
] as const

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password must be 200 characters or fewer')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/\d/, 'Password must include a number')

/** 0–4 strength score used by the strength meter. */
export function passwordStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: 'Enter a password' }

  const requiredMet = PASSWORD_RULES.filter((r) => !r.optional && r.test(password)).length
  let score = Math.max(0, requiredMet - 1)
  if (PASSWORD_RULES[4].test(password)) score += 1
  if (password.length >= 14) score += 1
  score = Math.max(0, Math.min(4, score))

  return { score, label: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][score]! }
}

/** Suggest a username from a name, with a numeric suffix for uniqueness. */
export function suggestUsername(firstName: string, lastName: string, suffix?: number): string {
  const base = `${firstName}.${lastName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 24)

  const safeBase = base.length >= 4 ? base : `mmp.${base}`.slice(0, 24)
  return suffix ? `${safeBase}${suffix}`.slice(0, 30) : safeBase
}
