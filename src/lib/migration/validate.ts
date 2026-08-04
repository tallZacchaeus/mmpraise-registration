import { looksLikeFormula, type MigrationField } from './csv'
import { parseMmpCode } from '@/lib/volunteer/mmp-code'

/**
 * Legacy value translation.
 *
 * The 2022–2026 export writes its enums as display text — `21-25`,
 * `NON RCCG`, `Female` — and the platform stores typed values. Each map is
 * exact and closed: anything unrecognised is reported and dropped rather than
 * guessed, because a wrong age band or denomination written silently is worse
 * than a blank one flagged for a human.
 */
const AGE_RANGE_MAP: Record<string, string> = {
  '00-15': 'AGE_00_15',
  '16-20': 'AGE_16_20',
  '21-25': 'AGE_21_25',
  '26-30': 'AGE_26_30',
  '31-35': 'AGE_31_35',
  '36-40': 'AGE_36_40',
  '41-45': 'AGE_41_45',
  '46-50': 'AGE_46_50',
  '51 & ABOVE': 'AGE_51_PLUS',
  '51 AND ABOVE': 'AGE_51_PLUS',
  '51+': 'AGE_51_PLUS',
}

const GENDER_MAP: Record<string, string> = {
  FEMALE: 'FEMALE',
  MALE: 'MALE',
  F: 'FEMALE',
  M: 'MALE',
}

const DENOMINATION_MAP: Record<string, string> = {
  RCCG: 'RCCG',
  'NON RCCG': 'OTHER_CHRISTIAN',
  'NON-RCCG': 'OTHER_CHRISTIAN',
  'NON CHRISTIAN': 'NON_CHRISTIAN',
  'NON-CHRISTIAN': 'NON_CHRISTIAN',
}

export function translateAgeRange(value: string): string | null {
  return AGE_RANGE_MAP[value.trim().toUpperCase()] ?? null
}

export function translateGender(value: string): string | null {
  return GENDER_MAP[value.trim().toUpperCase()] ?? null
}

export function translateDenomination(value: string): string | null {
  return DENOMINATION_MAP[value.trim().toUpperCase()] ?? null
}

/**
 * A legacy username, brought within this platform's rules.
 *
 * The legacy system allowed capitals (`Bbgold`); ours is lowercase a–z, 0–9 and
 * `._-`, 3–30 characters. Lowercasing preserves what the person actually types
 * — sign-in matches usernames case-sensitively against the stored lowercase
 * form via the schema's own transform — and anything that comes out shorter
 * than three characters is not worth keeping.
 */
export function normaliseUsername(value: string): string | null {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30)
  return cleaned.length >= 3 ? cleaned : null
}

/**
 * Row-level validation for the previous-edition import.
 *
 * Pure and synchronous — no database access — so the whole file can be checked
 * in a dry run, and so the rules are directly unit-testable without a fixture
 * database. Database-dependent decisions (does this email already exist?) are
 * made separately in `match.ts`.
 */

export type MessageLevel = 'error' | 'warning'
export type ValidationMessage = { field: string; level: MessageLevel; message: string }

export type NormalisedRow = {
  rowNumber: number
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  previousDepartment: string | null
  previousRegistrationId: string | null
  previousEdition: string | null
  /** Everything mapped, kept verbatim for the audit trail and reports. */
  source: Record<string, string>
  messages: ValidationMessage[]
}

/**
 * Deliberately permissive.
 *
 * This is a legacy list, not a signup form: the aim is to catch addresses that
 * cannot possibly receive mail, not to adjudicate the RFC. Anything stricter
 * rejects real people, and a rejected row is a volunteer who never hears from
 * the organisation again.
 */
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i

/** Lower-cased and trimmed. The single key every match is made on. */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** Digits and a leading +, so formatting differences do not defeat comparison. */
export function normalisePhone(value: string): string | null {
  const cleaned = value.replace(/[^\d+]/g, '')
  if (cleaned.replace(/\D/g, '').length < 7) return null
  return cleaned
}

function parseDate(value: string): Date | null {
  // ISO first; then the day-first forms common in Nigerian records. Ambiguous
  // month/day ordering is why an out-of-range day is treated as unparseable
  // rather than silently reinterpreted.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) {
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(value)
  if (dmy) {
    const [, d, m, y] = dmy
    const day = Number(d)
    const month = Number(m)
    if (day > 31 || month > 12) return null
    const date = new Date(Date.UTC(Number(y), month - 1, day))
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

/**
 * Turn one raw CSV row into a normalised record plus its messages.
 *
 * Errors block the row; warnings do not. The distinction matters because a
 * missing surname is worth flagging but is not a reason to deny someone their
 * account.
 */
export function validateRow(
  raw: Record<string, string>,
  mapping: Record<string, MigrationField | ''>,
  rowNumber: number,
): NormalisedRow {
  const messages: ValidationMessage[] = []
  const source: Record<string, string> = {}

  // Project the row through the mapping, ignoring unmapped columns entirely.
  const get = (field: MigrationField): string => {
    for (const [header, mapped] of Object.entries(mapping)) {
      if (mapped === field) return (raw[header] ?? '').trim()
    }
    return ''
  }

  for (const [header, mapped] of Object.entries(mapping)) {
    if (!mapped) continue
    const value = (raw[header] ?? '').trim()
    if (value) source[mapped] = value

    /*
     * Reported, never silently stripped — but only when it is worth reporting.
     *
     * `looksLikeFormula` deliberately matches a leading `+` or `-`, because
     * that is what a spreadsheet executes and every value leaving this system
     * is escaped on that basis. Warning about it is a different question: in a
     * Nigerian volunteer list *every* phone number starts with `+234`, so
     * warning on the raw test produced one warning per row and buried the three
     * real problems in five thousand lines of noise.
     *
     * A leading `+` or `-` followed by digits is a phone number. It is still
     * escaped on the way out; it is simply not something an administrator needs
     * to be told about.
     */
    if (looksLikeFormula(value) && !/^[+-]\d/.test(value)) {
      messages.push({
        field: mapped,
        level: 'warning',
        message: 'Value begins with a spreadsheet formula character and will be escaped on export.',
      })
    }
  }

  const rawEmail = get('email')
  const email = normaliseEmail(rawEmail)

  if (!rawEmail) {
    messages.push({ field: 'email', level: 'error', message: 'Email address is missing.' })
  } else if (!EMAIL.test(email)) {
    messages.push({ field: 'email', level: 'error', message: 'Email address is not valid.' })
  } else if (email.length > 254) {
    messages.push({ field: 'email', level: 'error', message: 'Email address is too long.' })
  }

  const firstName = get('firstName') || null
  const lastName = get('lastName') || null
  if (!firstName) {
    messages.push({ field: 'firstName', level: 'warning', message: 'First name is missing.' })
  }
  if (!lastName) {
    messages.push({ field: 'lastName', level: 'warning', message: 'Last name is missing.' })
  }

  const rawPhone = get('phone')
  let phone: string | null = null
  if (rawPhone) {
    phone = normalisePhone(rawPhone)
    if (!phone) {
      messages.push({
        field: 'phone',
        level: 'warning',
        message: 'Phone number could not be read and will not be imported.',
      })
    }
  }

  const rawDob = get('dateOfBirth')
  if (rawDob && !parseDate(rawDob)) {
    messages.push({
      field: 'dateOfBirth',
      level: 'warning',
      message: 'Date of birth could not be read and will not be imported.',
    })
  }

  /*
   * The translated fields. Verdicts only — the translation is re-run at import
   * from `source`, so validate and import can never apply different rules.
   * Every failure is a warning, never an error: a wrong age band is not a
   * reason to deny somebody their account.
   */
  const rawMmpCode = get('mmpCode')
  if (rawMmpCode && !parseMmpCode(rawMmpCode)) {
    messages.push({
      field: 'mmpCode',
      level: 'warning',
      message: 'MMP number is not in the MMP####### format; a new number will be allocated.',
    })
  }

  const rawAge = get('ageRange')
  if (rawAge && !translateAgeRange(rawAge)) {
    messages.push({
      field: 'ageRange',
      level: 'warning',
      message: `Age range "${rawAge}" is not recognised and will not be imported.`,
    })
  }

  const rawGender = get('gender')
  if (rawGender && !translateGender(rawGender)) {
    messages.push({
      field: 'gender',
      level: 'warning',
      message: `Gender "${rawGender}" is not recognised and will not be imported.`,
    })
  }

  const rawDenomination = get('denomination')
  if (rawDenomination && !translateDenomination(rawDenomination)) {
    messages.push({
      field: 'denomination',
      level: 'warning',
      message: `Denomination "${rawDenomination}" is not recognised and will not be imported.`,
    })
  }

  const rawUsername = get('username')
  if (rawUsername && !normaliseUsername(rawUsername)) {
    messages.push({
      field: 'username',
      level: 'warning',
      message: 'Username is too short once invalid characters are removed; one will be generated.',
    })
  }

  return {
    rowNumber,
    email,
    firstName,
    lastName,
    phone,
    previousDepartment: get('previousDepartment') || null,
    previousRegistrationId: get('previousRegistrationId') || null,
    previousEdition: get('previousEdition') || null,
    source,
    messages,
  }
}

export function hasError(messages: ValidationMessage[]): boolean {
  return messages.some((m) => m.level === 'error')
}

/** The email column must be mapped; nothing can be matched without it. */
export function mappingErrors(mapping: Record<string, MigrationField | ''>): string[] {
  const mapped = Object.values(mapping).filter(Boolean)
  const errors: string[] = []

  if (!mapped.includes('email')) {
    errors.push('Map a column to “Email address” — it is how records are matched to accounts.')
  }

  const seen = new Set<string>()
  for (const field of mapped) {
    if (seen.has(field)) errors.push(`Two columns are mapped to the same field: ${field}.`)
    seen.add(field)
  }
  return errors
}
