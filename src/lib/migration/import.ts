import 'server-only'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { suggestUsername } from '@/lib/validation/common'
import { nextMmpCode } from '@/lib/volunteer/allocate-mmp-code'
import { parseMmpCode } from '@/lib/volunteer/mmp-code'
import type { AgeRange, Denomination, Gender } from '@/generated/prisma/enums'
import {
  normaliseUsername,
  translateAgeRange,
  translateDenomination,
  translateGender,
} from './validate'
import type { MigrationRowAction } from '@/generated/prisma/enums'

/**
 * Executing a validated import.
 *
 * Three properties hold, and the tests exist to prove they keep holding:
 *
 *  1. **No duplicate accounts.** Matching is on the normalised email only.
 *     Phone is a review signal, never a match key — two family members sharing
 *     a handset is common and must not merge their records.
 *  2. **Idempotent.** Every write is keyed on `(batchId, rowNumber)` or on the
 *     user's email, so re-running a chunk after a crash converges rather than
 *     accumulating.
 *  3. **Non-destructive.** An existing profile field is only ever filled when
 *     it is empty. A value that differs is recorded as a conflict for a human,
 *     never written over.
 */

/**
 * Migrated accounts get a password that cannot be verified.
 *
 * `verifyPassword` requires the stored value to start with `scrypt$`, so this
 * sentinel can never match any input — there is no shared secret, no default,
 * and nothing to leak. The account becomes usable only by proving control of
 * the mailbox through the ordinary reset flow.
 */
export const UNUSABLE_PASSWORD = '!migrated-no-password'

/** Fields that may be written into an empty profile slot. */
type ProfilePatch = { firstName?: string; lastName?: string; phone?: string; city?: string }

export type RowOutcome = {
  action: MigrationRowAction
  userId: string | null
  conflicts: { field: string; existing: string; incoming: string }[]
}

/**
 * The legacy MMP number from the file, when it can be honoured.
 *
 * Honoured means: parseable, and not already held by another account. Every
 * legacy code is below the sequence seed (2214059), so a valid code from the
 * file can never collide with a newly allocated one — only with another legacy
 * import, which the uniqueness check catches. When the code cannot be used the
 * account still gets a number from the sequence, and the row records why.
 */
async function resolveMmpCode(
  raw: string | undefined,
): Promise<{ code: string; note: string | null }> {
  const parsed = raw ? parseMmpCode(raw) : null
  if (!parsed) {
    return {
      code: await nextMmpCode(),
      note: raw ? `MMP number "${raw}" could not be read; a new number was allocated.` : null,
    }
  }

  const taken = await db.user.findUnique({ where: { mmpCode: parsed }, select: { id: true } })
  if (taken) {
    return {
      code: await nextMmpCode(),
      note: `MMP number ${parsed} already belongs to another account; a new number was allocated.`,
    }
  }

  return { code: parsed, note: null }
}

/**
 * Resolve a legacy country name to a reference row.
 *
 * Exact, case-insensitive name match only. "Nigeria" covers 99.5% of the file;
 * anything the reference data does not know stays in the participation metadata
 * rather than being guessed at.
 */
async function resolveCountryId(name: string | undefined): Promise<string | null> {
  if (!name?.trim()) return null
  const country = await db.country.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' } },
    select: { id: true },
  })
  return country?.id ?? null
}

/** A username that is free, derived from the person's name where possible. */
async function allocateUsername(
  email: string,
  firstName: string | null,
  lastName: string | null,
  preferred?: string | null,
) {
  /*
   * The legacy username first. People sign in with what they remember, and
   * 13,973 of them remember the one they chose — a generated `gracea` is only
   * for when theirs is unusable or already taken.
   */
  if (preferred) {
    const taken = await db.user.findUnique({ where: { username: preferred }, select: { id: true } })
    if (!taken) return preferred
  }

  const base =
    firstName && lastName
      ? suggestUsername(firstName, lastName)
      : suggestUsername(email.split('@')[0] ?? 'volunteer', 'mmp')

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt}`.slice(0, 30)
    const taken = await db.user.findUnique({ where: { username: candidate }, select: { id: true } })
    if (!taken) return candidate
  }
  // Exhausted the readable options; fall back to something certainly unique.
  return `mmp${randomUUID().replace(/-/g, '').slice(0, 20)}`
}

/**
 * Import one already-validated row.
 *
 * Returns what happened so the caller can update the record and the batch
 * counters in the same pass.
 */
export async function importRow(params: {
  batchId: string
  edition: string
  year: number | null
  row: {
    rowNumber: number
    email: string
    firstName: string | null
    lastName: string | null
    phone: string | null
    previousDepartment: string | null
    previousRegistrationId: string | null
    source: Record<string, string>
  }
}): Promise<RowOutcome> {
  const { batchId, edition, year, row } = params
  const conflicts: RowOutcome['conflicts'] = []

  const existing = await db.user.findUnique({
    where: { email: row.email },
    include: { profile: true },
  })

  if (existing) {
    // ---------------------------------------------------- existing account
    // Never create a second account, never overwrite what is already there.
    const patch: ProfilePatch = {}

    if (existing.profile) {
      if (!existing.profile.firstName && row.firstName) patch.firstName = row.firstName
      if (!existing.profile.lastName && row.lastName) patch.lastName = row.lastName
      if (!existing.profile.phone && row.phone) patch.phone = row.phone

      // Differences are surfaced, not applied. The current record was entered
      // by the person themselves; the CSV is older and less trustworthy.
      if (row.firstName && existing.profile.firstName && existing.profile.firstName !== row.firstName) {
        conflicts.push({
          field: 'firstName',
          existing: existing.profile.firstName,
          incoming: row.firstName,
        })
      }
      if (row.lastName && existing.profile.lastName && existing.profile.lastName !== row.lastName) {
        conflicts.push({
          field: 'lastName',
          existing: existing.profile.lastName,
          incoming: row.lastName,
        })
      }
      if (row.phone && existing.profile.phone && existing.profile.phone !== row.phone) {
        conflicts.push({ field: 'phone', existing: existing.profile.phone, incoming: row.phone })
      }

      if (Object.keys(patch).length > 0) {
        await db.volunteerProfile.update({ where: { userId: existing.id }, data: patch })
      }
    }

    await recordParticipation({ userId: existing.id, edition, year, row, batchId })

    await audit({
      action: 'migration.row_matched',
      entityType: 'MigrationRecord',
      entityId: `${batchId}:${row.rowNumber}`,
      metadata: { outcome: 'matched_existing', userId: existing.id, conflicts: conflicts.length },
    })

    return { action: 'MATCH_EXISTING', userId: existing.id, conflicts }
  }

  // -------------------------------------------------------- new account
  const username = await allocateUsername(
    row.email,
    row.firstName,
    row.lastName,
    row.source.username ? normaliseUsername(row.source.username) : null,
  )

  /*
   * The identity the person already has, honoured wherever it can be.
   *
   * The MMP number and username come from the file when they are usable —
   * these are what four editions of volunteers actually know — and fall back
   * to allocation when they are not, with the reason recorded on the row.
   */
  const mmp = await resolveMmpCode(row.source.mmpCode)
  if (mmp.note) {
    conflicts.push({ field: 'mmpCode', existing: mmp.code, incoming: row.source.mmpCode ?? '' })
  }

  // Enum translation re-runs the same pure functions the dry run used, so the
  // report and the import can never disagree about a value.
  const gender = row.source.gender ? translateGender(row.source.gender) : null
  const ageRange = row.source.ageRange ? translateAgeRange(row.source.ageRange) : null
  const denomination = row.source.denomination
    ? translateDenomination(row.source.denomination)
    : null
  const countryId = await resolveCountryId(row.source.country)

  const created = await db.user.create({
    data: {
      email: row.email,
      username,
      // Phone is unique on User; a legacy duplicate must not fail the import,
      // so it is kept on the profile only and left off the account.
      passwordHash: UNUSABLE_PASSWORD,
      mmpCode: mmp.code,
      isPreviousEditionUser: true,
      mustReviewProfile: true,
      migrationSource: batchId,
      // Deliberately NOT verified. Appearing in a spreadsheet is not proof that
      // anyone controls the mailbox; the reset flow establishes that.
      emailVerifiedAt: null,
      profile: {
        create: {
          firstName: row.firstName ?? 'Volunteer',
          lastName: row.lastName ?? '',
          phone: row.phone,
          gender: (gender as Gender | null) ?? undefined,
          ageRange: (ageRange as AgeRange | null) ?? undefined,
          denomination: (denomination as Denomination | null) ?? undefined,
          city: row.source.city || undefined,
          addressLine: row.source.address || undefined,
          countryId: countryId ?? undefined,
        },
      },
    },
  })

  await recordParticipation({ userId: created.id, edition, year, row, batchId })

  await audit({
    action: 'migration.row_created',
    entityType: 'MigrationRecord',
    entityId: `${batchId}:${row.rowNumber}`,
    metadata: { outcome: 'created', userId: created.id, mmpCode: mmp.code },
  })

  return { action: 'CREATE', userId: created.id, conflicts }
}

/**
 * Record prior participation.
 *
 * Upserted on `(userId, edition)` so a re-run updates the same row. This is
 * never a VolunteerApplication: the person has not applied for the current
 * edition, and writing one would inflate every figure on the dashboard and put
 * someone in a review queue they never asked to join.
 */
async function recordParticipation(params: {
  userId: string
  edition: string
  year: number | null
  row: { previousDepartment: string | null; previousRegistrationId: string | null; source: Record<string, string> }
  batchId: string
}) {
  const { userId, edition, year, row, batchId } = params
  const data = {
    previousDepartment: row.previousDepartment,
    /*
     * The legacy MMP number doubles as the person's old registration id — it
     * was the only identifier the previous system issued. When a file maps the
     * code but no separate registration-id column, the code fills the slot so
     * the participation record still says what the person was known as.
     */
    previousRegistrationId: row.previousRegistrationId ?? row.source.mmpCode ?? null,
    metadata: row.source as never,
    batchId,
    year,
  }

  await db.previousEditionParticipation.upsert({
    where: { userId_edition: { userId, edition } },
    update: data,
    create: { userId, edition, ...data },
  })
}
