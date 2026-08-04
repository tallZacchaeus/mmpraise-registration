/**
 * The MMP number — a volunteer's permanent identifier.
 *
 * `MMP` followed by seven digits: `MMP2214059`. A volunteer registers once and
 * returns each edition to mark availability, so this identifies the *person*
 * and is issued exactly once. The legacy data is the proof: of the 2,612 codes
 * issued in the 2022 era, 1,026 are still attached to people who served in
 * 2026. Nobody in 13,973 rows holds two.
 *
 * Not to be confused with `VolunteerApplication.registrationId`
 * (`MMP-2027-000123`), which references one edition's participation and is not
 * shown to volunteers — two numbers both beginning "MMP" is a check-in desk
 * collision waiting to happen.
 *
 * Free of `server-only` imports: the sign-in form normalises what was typed
 * before sending it, so the browser needs these rules too.
 */

/** `MMP` + exactly seven digits. */
const MMP_CODE = /^MMP\d{7}$/

export function isMmpCode(value: string): boolean {
  return MMP_CODE.test(value.trim().toUpperCase())
}

/**
 * Interpret what somebody typed into the identifier box as an MMP number.
 *
 * Deliberately forgiving, because every one of these is a volunteer holding the
 * right number and typing it the way it looks to them:
 *
 *   MMP2214059 · mmp2214059 · MMP 2214059 · MMP-2214059 · 2214059
 *
 * Returns the canonical form, or null when the input is not a plausible code —
 * in which case the caller falls back to matching an email or a username.
 */
export function parseMmpCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[\s\-_]/g, '')
  if (cleaned.length === 0) return null

  // With the prefix, or bare digits. Nothing else — an 8-digit number is not a
  // typo of a 7-digit one, it is a different thing, and guessing would let a
  // volunteer sign in as somebody else.
  const digits = cleaned.startsWith('MMP') ? cleaned.slice(3) : cleaned
  if (!/^\d{7}$/.test(digits)) return null

  return `MMP${digits}`
}

/** Format a sequence value as a code. Zero-padded to seven digits. */
export function formatMmpCode(value: number | bigint): string {
  return `MMP${String(value).padStart(7, '0')}`
}
