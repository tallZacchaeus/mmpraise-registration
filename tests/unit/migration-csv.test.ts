import { describe, expect, it } from 'vitest'
import {
  csvCell,
  guessMapping,
  isForbiddenHeader,
  looksLikeFormula,
  neutraliseForCsv,
  parseCsv,
  sampleTemplate,
  toCsv,
} from '@/lib/migration/csv'
import {
  hasError,
  mappingErrors,
  normaliseEmail,
  normalisePhone,
  validateRow,
} from '@/lib/migration/validate'

describe('csv parsing', () => {
  it('reads a well-formed file', () => {
    const csv = 'Email,First name,Last name\nA@Example.com,Grace,Adeyemi\n'
    const parsed = parseCsv(csv, { maxRows: 100 })

    expect(parsed.headers).toEqual(['Email', 'First name', 'Last name'])
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0]!['Email']).toBe('A@Example.com')
  })

  it('handles quoted fields containing commas and newlines', () => {
    // The exact case a naive split on "," corrupts.
    const csv = 'Email,Notes\n"a@b.com","Served in Ushering, Media\nand Welfare"\n'
    const parsed = parseCsv(csv, { maxRows: 100 })

    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0]!['Notes']).toContain('Ushering, Media')
    expect(parsed.rows[0]!['Notes']).toContain('Welfare')
  })

  it('strips a byte-order mark so the first header still matches', () => {
    const parsed = parseCsv('﻿Email,First name\na@b.com,Grace\n', { maxRows: 10 })
    expect(parsed.headers[0]).toBe('Email')
  })

  it('caps the number of rows read and says so', () => {
    const rows = Array.from({ length: 12 }, (_, i) => `user${i}@example.com`).join('\n')
    const parsed = parseCsv(`Email\n${rows}\n`, { maxRows: 5 })

    expect(parsed.rows).toHaveLength(5)
    expect(parsed.parseErrors.join(' ')).toMatch(/only the first 5/i)
  })

  it('returns nothing useful for an empty file rather than throwing', () => {
    const parsed = parseCsv('', { maxRows: 10 })
    expect(parsed.rows).toHaveLength(0)
    expect(parsed.headers).toEqual([])
  })
})

describe('credential columns', () => {
  it('flags any header that looks like a secret', () => {
    for (const header of ['password', 'Password Hash', 'pwd', 'user_secret', 'api token', 'PIN']) {
      expect(isForbiddenHeader(header), header).toBe(true)
    }
  })

  it('does not flag ordinary columns', () => {
    for (const header of ['Email', 'First name', 'Parish', 'Occupation', 'Notes']) {
      expect(isForbiddenHeader(header), header).toBe(false)
    }
  })

  it('never auto-maps a credential column', () => {
    const mapping = guessMapping(['Email', 'Password', 'First name'])
    expect(mapping['Password']).toBe('')
    expect(mapping['Email']).toBe('email')
  })
})

describe('csv injection', () => {
  it('recognises every formula lead character', () => {
    for (const value of ['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd', '\rcmd']) {
      expect(looksLikeFormula(value), value).toBe(true)
    }
  })

  it('neutralises dangerous values on export', () => {
    expect(neutraliseForCsv('=HYPERLINK("http://evil","click")')).toBe(
      '\'=HYPERLINK("http://evil","click")',
    )
    expect(neutraliseForCsv('Grace')).toBe('Grace')
  })

  it('quotes and escapes cells so a value cannot break out of its column', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(null)).toBe('""')
  })

  it('produces an export whose formula cells are inert', () => {
    const out = toCsv(['Name'], [['=cmd|calc']])
    expect(out).toContain('"\'=cmd|calc"')
  })

  it('ships a template that parses back cleanly', () => {
    const parsed = parseCsv(sampleTemplate(), { maxRows: 10 })
    expect(parsed.headers).toContain('Email')
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.forbiddenHeaders).toEqual([])
  })
})

describe('column mapping', () => {
  it('guesses common headers and leaves unknown ones unmapped', () => {
    const mapping = guessMapping(['E-mail', 'Surname', 'Mobile', 'Something odd'])
    expect(mapping['E-mail']).toBe('email')
    expect(mapping['Surname']).toBe('lastName')
    expect(mapping['Mobile']).toBe('phone')
    expect(mapping['Something odd']).toBe('')
  })

  it('requires an email column', () => {
    expect(mappingErrors({ A: 'firstName' }).join(' ')).toMatch(/email/i)
    expect(mappingErrors({ A: 'email' })).toEqual([])
  })

  it('rejects two columns mapped to the same field', () => {
    expect(mappingErrors({ A: 'email', B: 'email' }).join(' ')).toMatch(/same field/i)
  })
})

describe('row validation', () => {
  const mapping = { Email: 'email', First: 'firstName', Last: 'lastName', Phone: 'phone' } as const

  it('accepts a complete row', () => {
    const row = validateRow(
      { Email: ' Grace@Example.COM ', First: 'Grace', Last: 'Adeyemi', Phone: '+234 803 000 0000' },
      mapping,
      1,
    )
    expect(hasError(row.messages)).toBe(false)
    expect(row.email).toBe('grace@example.com')
    expect(row.phone).toBe('+2348030000000')
  })

  it('rejects a row with no usable email', () => {
    expect(hasError(validateRow({ Email: '' }, mapping, 1).messages)).toBe(true)
    expect(hasError(validateRow({ Email: 'not-an-email' }, mapping, 1).messages)).toBe(true)
    expect(hasError(validateRow({ Email: 'a@b' }, mapping, 1).messages)).toBe(true)
  })

  it('treats a missing name as a warning, never as a reason to drop someone', () => {
    const row = validateRow({ Email: 'a@b.com' }, mapping, 1)
    expect(hasError(row.messages)).toBe(false)
    expect(row.messages.some((m) => m.field === 'firstName' && m.level === 'warning')).toBe(true)
  })

  it('warns rather than fails on an unreadable phone number', () => {
    const row = validateRow({ Email: 'a@b.com', Phone: '12' }, mapping, 1)
    expect(hasError(row.messages)).toBe(false)
    expect(row.phone).toBeNull()
  })

  it('reports a formula value without discarding the row', () => {
    const row = validateRow({ Email: 'a@b.com', First: '=1+1' }, mapping, 1)
    expect(hasError(row.messages)).toBe(false)
    expect(row.messages.some((m) => /formula/i.test(m.message))).toBe(true)
  })

  it('normalises email consistently, which is what makes matching deterministic', () => {
    expect(normaliseEmail('  A@B.COM ')).toBe('a@b.com')
    expect(normaliseEmail('a@b.com')).toBe(normaliseEmail('A@B.CoM'))
  })

  it('normalises phone numbers so formatting differences do not defeat comparison', () => {
    expect(normalisePhone('+234 (803) 000-0000')).toBe('+2348030000000')
    expect(normalisePhone('123')).toBeNull()
  })
})

describe('legacy value translation', () => {
  it('maps every age band the 2022-2026 export actually uses', async () => {
    const { translateAgeRange } = await import('@/lib/migration/validate')
    // The exact distinct values measured in the export, all 13,973 rows.
    const expected: Record<string, string> = {
      '00-15': 'AGE_00_15',
      '16-20': 'AGE_16_20',
      '21-25': 'AGE_21_25',
      '26-30': 'AGE_26_30',
      '31-35': 'AGE_31_35',
      '36-40': 'AGE_36_40',
      '41-45': 'AGE_41_45',
      '46-50': 'AGE_46_50',
      '51 & Above': 'AGE_51_PLUS',
    }
    for (const [legacy, ours] of Object.entries(expected)) {
      expect(translateAgeRange(legacy), legacy).toBe(ours)
    }
    // Unknown values are dropped, never guessed.
    expect(translateAgeRange('18-24')).toBeNull()
  })

  it('maps gender and denomination, and refuses to guess', async () => {
    const { translateDenomination, translateGender } = await import('@/lib/migration/validate')
    expect(translateGender('Female')).toBe('FEMALE')
    expect(translateGender('male')).toBe('MALE')
    expect(translateGender('unknown')).toBeNull()

    expect(translateDenomination('RCCG')).toBe('RCCG')
    expect(translateDenomination('NON RCCG')).toBe('OTHER_CHRISTIAN')
    expect(translateDenomination('NON Christian')).toBe('NON_CHRISTIAN')
    expect(translateDenomination('Baptist')).toBeNull()
  })

  it('brings legacy usernames within the platform rules', async () => {
    const { normaliseUsername } = await import('@/lib/migration/validate')
    // Real shapes from the export: capitals, underscores, digits.
    expect(normaliseUsername('Bbgold')).toBe('bbgold')
    expect(normaliseUsername('grace_adeyemi99')).toBe('grace_adeyemi99')
    expect(normaliseUsername('  Ade Wale  ')).toBe('adewale')
    // Too short once cleaned — not worth keeping.
    expect(normaliseUsername('A!')).toBeNull()
    expect(normaliseUsername('')).toBeNull()
  })

  it('auto-maps the merged export headers, including the new fields', async () => {
    const { guessMapping } = await import('@/lib/migration/csv')
    const mapping = guessMapping([
      'Email', 'First name', 'Last name', 'Phone', 'Country', 'State',
      'Gender', 'Occupation', 'Previous department', 'Registration ID',
      'Edition', 'MMP username', 'Legacy user ID', 'Legacy UID', 'Age band',
      'Denomination', 'How you heard', 'Address', 'Accommodation',
    ])
    expect(mapping['MMP username']).toBe('username')
    expect(mapping['Legacy user ID']).toBe('legacyUserId')
    expect(mapping['Legacy UID']).toBe('legacyUid')
    expect(mapping['Age band']).toBe('ageRange')
    expect(mapping['Denomination']).toBe('denomination')
    expect(mapping['How you heard']).toBe('howHeard')
    expect(mapping['Address']).toBe('address')
    expect(mapping['Accommodation']).toBe('accommodation')
  })
})
