import Papa from 'papaparse'

/**
 * CSV handling for the previous-edition import.
 *
 * Parsing is delegated to papaparse rather than hand-rolled: quoted fields
 * containing commas, embedded newlines and doubled quotes are exactly where a
 * naive split goes wrong, and a wrong parse here silently corrupts people's
 * records.
 */

/** Fields an administrator may map a column onto. */
export const MIGRATION_FIELDS = [
  { key: 'email', label: 'Email address', required: true },
  { key: 'firstName', label: 'First name' },
  { key: 'middleName', label: 'Middle name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'phone', label: 'Phone number' },
  { key: 'country', label: 'Country' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
  { key: 'gender', label: 'Gender' },
  { key: 'dateOfBirth', label: 'Date of birth' },
  { key: 'previousDepartment', label: 'Previous department' },
  { key: 'previousRegistrationId', label: 'Previous registration ID' },
  { key: 'church', label: 'Church' },
  { key: 'rccgProvince', label: 'RCCG province' },
  { key: 'rccgRegion', label: 'RCCG region' },
  { key: 'rccgParish', label: 'RCCG parish' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'previousEdition', label: 'Previous edition' },
  { key: 'notes', label: 'Legacy notes' },

  /*
   * The fields the 2022–2026 export actually carries, added so a single upload
   * can express all of it. The first two are identity-bearing and are applied
   * to the account; the enums are translated; the rest are kept verbatim on
   * the participation record so nothing in the file is silently lost.
   */
  { key: 'mmpCode', label: 'MMP number' },
  { key: 'username', label: 'Username' },
  { key: 'ageRange', label: 'Age range' },
  { key: 'denomination', label: 'Denomination' },
  { key: 'address', label: 'Address' },
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'legacyUserId', label: 'Legacy user ID' },
  { key: 'legacyUid', label: 'Legacy UID' },
  { key: 'howHeard', label: 'How they heard' },
] as const

export type MigrationField = (typeof MIGRATION_FIELDS)[number]['key']

/**
 * Headers that must never be mapped.
 *
 * Passwords are not migrated under any circumstances — a hash from another
 * system has unknown strength and unknown provenance, and a plaintext column
 * means the source file is already a breach. Detected columns are reported to
 * the administrator and their values are never read.
 */
const FORBIDDEN_HEADER = /pass(word|wd|phrase)|pwd|secret|token|hash|salt|otp|pin\b/i

export function isForbiddenHeader(header: string): boolean {
  return FORBIDDEN_HEADER.test(header)
}

/**
 * Characters a spreadsheet treats as the start of a formula.
 *
 * A cell beginning with one of these is executed when the exported file is
 * opened, which turns a contact list into a delivery mechanism. Values are
 * neutralised on the way out rather than rejected on the way in, because a name
 * legitimately starting with "-" is not an attack.
 */
const FORMULA_START = /^[=+\-@\t\r]/

export function looksLikeFormula(value: string): boolean {
  return FORMULA_START.test(value)
}

/** Prefix a formula-looking value so a spreadsheet treats it as text. */
export function neutraliseForCsv(value: string): string {
  return looksLikeFormula(value) ? `'${value}` : value
}

/** Quote a value for CSV output, neutralising formulas first. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = neutraliseForCsv(text)
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  // CRLF and a BOM, so Excel opens UTF-8 correctly rather than mangling accents.
  return `﻿${lines.join('\r\n')}\r\n`
}

export type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
  /** Headers that look like credentials and must not be mapped. */
  forbiddenHeaders: string[]
  parseErrors: string[]
}

/**
 * Parse an uploaded CSV.
 *
 * Whitespace-only values become empty strings so a cell containing " " is
 * treated as missing rather than as data.
 */
export function parseCsv(text: string, { maxRows }: { maxRows: number }): ParsedCsv {
  // Strip a byte-order mark — otherwise the first header becomes "﻿email"
  // and never matches anything.
  const clean = text.replace(/^﻿/, '')

  const result = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  })

  const headers = (result.meta.fields ?? []).filter((h) => h.length > 0)
  const parseErrors = result.errors.slice(0, 20).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`)

  const rows = result.data.slice(0, maxRows)
  if (result.data.length > maxRows) {
    parseErrors.push(
      `File contains ${result.data.length} rows; only the first ${maxRows} were read.`,
    )
  }

  return {
    headers,
    rows,
    forbiddenHeaders: headers.filter(isForbiddenHeader),
    parseErrors,
  }
}

/**
 * Guess a mapping from headers to fields, so an administrator confirms rather
 * than builds one from scratch. Only exact-ish matches are guessed; anything
 * ambiguous is left unmapped for a human to decide.
 */
const ALIASES: Record<string, MigrationField> = {
  email: 'email',
  emailaddress: 'email',
  mail: 'email',
  firstname: 'firstName',
  givenname: 'firstName',
  surname: 'lastName',
  lastname: 'lastName',
  familyname: 'lastName',
  middlename: 'middleName',
  phone: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  country: 'country',
  state: 'state',
  city: 'city',
  gender: 'gender',
  dateofbirth: 'dateOfBirth',
  dob: 'dateOfBirth',
  department: 'previousDepartment',
  previousdepartment: 'previousDepartment',
  registrationid: 'previousRegistrationId',
  regid: 'previousRegistrationId',
  church: 'church',
  province: 'rccgProvince',
  region: 'rccgRegion',
  parish: 'rccgParish',
  occupation: 'occupation',
  edition: 'previousEdition',
  year: 'previousEdition',
  notes: 'notes',
  mmpcode: 'mmpCode',
  mmpnumber: 'mmpCode',
  username: 'username',
  mmpusername: 'username',
  age: 'ageRange',
  agerange: 'ageRange',
  ageband: 'ageRange',
  denomination: 'denomination',
  address: 'address',
  accom: 'accommodation',
  accommodation: 'accommodation',
  legacyuserid: 'legacyUserId',
  userid: 'legacyUserId',
  legacyuid: 'legacyUid',
  uid: 'legacyUid',
  howheard: 'howHeard',
  howyouheard: 'howHeard',
  howtheyheard: 'howHeard',
}

export function guessMapping(headers: string[]): Record<string, MigrationField | ''> {
  const mapping: Record<string, MigrationField | ''> = {}
  const used = new Set<MigrationField>()

  for (const header of headers) {
    if (isForbiddenHeader(header)) {
      mapping[header] = ''
      continue
    }
    const key = header.toLowerCase().replace(/[^a-z]/g, '')
    const guess = ALIASES[key]
    if (guess && !used.has(guess)) {
      mapping[header] = guess
      used.add(guess)
    } else {
      mapping[header] = ''
    }
  }
  return mapping
}

/** The template an administrator downloads before preparing their file. */
export function sampleTemplate(): string {
  return toCsv(
    [
      'Email',
      'First name',
      'Last name',
      'Phone',
      'Country',
      'Previous department',
      'MMP number',
      'Username',
      'Age range',
      'Gender',
      'Denomination',
      'Edition',
    ],
    [
      [
        'grace.adeyemi@example.com',
        'Grace',
        'Adeyemi',
        '+2348030000000',
        'Nigeria',
        'Ushering',
        'MMP2203417',
        'graceadeyemi',
        '21-25',
        'Female',
        'RCCG',
        '2024',
      ],
    ],
  )
}
