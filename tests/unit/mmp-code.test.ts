import { describe, expect, it } from 'vitest'
import { formatMmpCode, isMmpCode, parseMmpCode } from '@/lib/volunteer/mmp-code'

/**
 * The MMP number's parsing rules.
 *
 * Two properties matter, and they pull against each other:
 *
 *  - **Forgiving**, because 13,969 migrated volunteers will type their number
 *    the way it looks to them, and a rejected sign-in is a support ticket.
 *  - **Never creative**, because this resolves to an account. Anything that is
 *    not unambiguously one person's number must return null and fall through to
 *    email/username matching, rather than being coerced into a near miss.
 */

describe('parseMmpCode', () => {
  it('accepts the number the way a volunteer would actually type it', () => {
    for (const input of [
      'MMP2214059',
      'mmp2214059',
      'Mmp2214059',
      '  MMP2214059  ',
      'MMP 2214059',
      'MMP-2214059',
      'MMP_2214059',
      '2214059',
      '221 4059',
    ]) {
      expect(parseMmpCode(input), input).toBe('MMP2214059')
    }
  })

  it('keeps leading zeros, because the code is not a number', () => {
    // MMP0000042 and MMP42 are not the same thing, and the sequence will reach
    // low values only if it is ever reseeded — but the format must hold anyway.
    expect(parseMmpCode('MMP0000042')).toBe('MMP0000042')
    expect(parseMmpCode('0000042')).toBe('MMP0000042')
  })

  it('refuses anything that is not exactly seven digits', () => {
    /*
     * The important case is the last two. An 8-digit number is not a typo of a
     * 7-digit one — padding or truncating it would sign somebody in as a
     * different volunteer.
     */
    for (const input of ['', 'MMP', 'MMP123', 'MMP221405', 'MMP22140599', '221405', '22140599']) {
      expect(parseMmpCode(input), input).toBeNull()
    }
  })

  it('refuses an email or a username so they fall through to their own match', () => {
    for (const input of [
      'grace@example.com',
      'graceadeyemi',
      'mmpraise',
      'MMP-2027-000123', // the per-edition reference, deliberately not a code
      'MMP2214059x',
      'MMPabcdefg',
    ]) {
      expect(parseMmpCode(input), input).toBeNull()
    }
  })

  it('does not mistake the per-edition registration reference for a number', () => {
    /*
     * Both begin "MMP", which is exactly why this matters: if the reference
     * parsed as a code it would resolve to whichever volunteer happened to hold
     * `MMP2027000` — a real account, and the wrong one.
     */
    expect(parseMmpCode('MMP-2027-000123')).toBeNull()
    expect(isMmpCode('MMP-2027-000123')).toBe(false)
  })
})

describe('isMmpCode', () => {
  it('recognises only the canonical form', () => {
    expect(isMmpCode('MMP2214059')).toBe(true)
    expect(isMmpCode('mmp2214059')).toBe(true)
    expect(isMmpCode('MMP 2214059')).toBe(false)
    expect(isMmpCode('2214059')).toBe(false)
  })
})

describe('formatMmpCode', () => {
  it('pads to seven digits', () => {
    expect(formatMmpCode(2214059)).toBe('MMP2214059')
    expect(formatMmpCode(42)).toBe('MMP0000042')
    // `nextval` returns a bigint, so the formatter has to accept one.
    expect(formatMmpCode(BigInt(2214059))).toBe('MMP2214059')
  })

  it('keeps the format when the sequence rolls past 2299999', () => {
    /*
     * The "22" was specified as a year prefix and never implemented — five
     * years of legacy data all use it. Treating the value as a plain integer is
     * what makes the roll-over a non-event: still MMP#######, nothing downstream
     * changes, and nobody has to be told.
     */
    expect(formatMmpCode(2300000)).toBe('MMP2300000')
    expect(formatMmpCode(9999999)).toBe('MMP9999999')
  })

  it('round-trips through the parser', () => {
    for (const value of [13, 2200013, 2214058, 2214059, 9999999]) {
      expect(parseMmpCode(formatMmpCode(value))).toBe(formatMmpCode(value))
    }
  })
})

describe('the legacy range and the new sequence cannot collide', () => {
  it('every legacy code sorts below the sequence seed', () => {
    /*
     * The sequence starts at 2214059, one past the highest legacy code. That is
     * the whole reason migrated volunteers can keep their existing number while
     * new volunteers draw from the same series.
     */
    const LEGACY_MAX = 2214058
    const SEQUENCE_START = 2214059
    expect(SEQUENCE_START).toBe(LEGACY_MAX + 1)
    expect(formatMmpCode(LEGACY_MAX) < formatMmpCode(SEQUENCE_START)).toBe(true)
  })
})
