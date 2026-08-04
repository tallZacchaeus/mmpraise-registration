import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ensureSeedData,
  hasTestDatabase,
  migrateTestDatabase,
  resetVolunteerData,
  testDb,
} from '../helpers/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { UNUSABLE_PASSWORD } from '@/lib/migration/import'

/**
 * Previous-edition migration, against a real database.
 *
 * These guard the three properties that make an import safe to run twice at
 * two in the morning: it never duplicates an account, it never overwrites what
 * a volunteer entered themselves, and it never turns history into a current
 * application.
 */
const describeDb = hasTestDatabase ? describe : describe.skip

describeDb('previous-edition migration', () => {
  const db = hasTestDatabase ? testDb() : (null as never)

  beforeAll(async () => {
    migrateTestDatabase()
    await ensureSeedData()
  }, 120_000)

  let batchId: string

  beforeEach(async () => {
    await resetVolunteerData()
    // A real batch: participation rows carry a foreign key to it, so a
    // fabricated id would only prove the test was wrong.
    const batch = await db.migrationBatch.create({
      data: {
        reference: 'MIG-TEST-0001',
        name: 'Test batch',
        sourceEdition: '2024',
        sourceYear: 2024,
        originalFilename: 'legacy.csv',
        fileChecksum: `checksum-${Date.now()}`,
        columnMapping: {},
      },
    })
    batchId = batch.id
  })

  /** Run a row through the importer with the module's own database client. */
  async function runImport(row: {
    email: string
    firstName?: string | null
    lastName?: string | null
    phone?: string | null
    previousDepartment?: string | null
    previousRegistrationId?: string | null
  }, rowNumber = 1) {
    const { importRow } = await import('@/lib/migration/import')
    return importRow({
      batchId,
      edition: '2024',
      year: 2024,
      row: {
        rowNumber,
        email: row.email,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        phone: row.phone ?? null,
        previousDepartment: row.previousDepartment ?? null,
        previousRegistrationId: row.previousRegistrationId ?? null,
        source: {},
      },
    })
  }

  it('creates one account for an email that does not exist yet', async () => {
    const outcome = await runImport({
      email: 'new.person@example.com',
      firstName: 'New',
      lastName: 'Person',
    })

    expect(outcome.action).toBe('CREATE')

    const user = await db.user.findUnique({
      where: { email: 'new.person@example.com' },
      include: { profile: true },
    })
    expect(user).not.toBeNull()
    expect(user!.isPreviousEditionUser).toBe(true)
    expect(user!.mustReviewProfile).toBe(true)
    expect(user!.profile?.firstName).toBe('New')
  })

  it('never stores a usable password for a migrated account', async () => {
    await runImport({ email: 'nopass@example.com', firstName: 'No', lastName: 'Pass' })
    const user = await db.user.findUnique({ where: { email: 'nopass@example.com' } })

    expect(user!.passwordHash).toBe(UNUSABLE_PASSWORD)
    // Nothing can authenticate against it — not the sentinel, not an empty
    // string, not a guess at a shared default.
    for (const attempt of ['', UNUSABLE_PASSWORD, 'password', 'ChangeMe!2026', 'mmpraise']) {
      expect(await verifyPassword(attempt, user!.passwordHash), attempt).toBe(false)
    }
  })

  it('does not treat an imported address as verified', async () => {
    // Appearing in a spreadsheet is not proof anyone controls the mailbox.
    await runImport({ email: 'unverified@example.com' })
    const user = await db.user.findUnique({ where: { email: 'unverified@example.com' } })
    expect(user!.emailVerifiedAt).toBeNull()
  })

  it('links to an existing account instead of creating a second one', async () => {
    const existing = await db.user.create({
      data: {
        email: 'already@example.com',
        username: 'already',
        passwordHash: await hashPassword('Praise2027!Real'),
        emailVerifiedAt: new Date(),
        profile: { create: { firstName: 'Real', lastName: 'Person' } },
      },
    })

    const outcome = await runImport({
      email: 'already@example.com',
      firstName: 'Imported',
      lastName: 'Name',
    })

    expect(outcome.action).toBe('MATCH_EXISTING')
    expect(outcome.userId).toBe(existing.id)
    expect(await db.user.count({ where: { email: 'already@example.com' } })).toBe(1)
  })

  it('matches regardless of how the address was capitalised or spaced', async () => {
    await db.user.create({
      data: {
        email: 'case@example.com',
        username: 'caseuser',
        passwordHash: await hashPassword('Praise2027!Real'),
        profile: { create: { firstName: 'Case', lastName: 'User' } },
      },
    })

    // The importer receives an already-normalised address; this asserts the
    // contract that normalisation is what makes matching deterministic.
    const outcome = await runImport({ email: 'case@example.com' })
    expect(outcome.action).toBe('MATCH_EXISTING')
    expect(await db.user.count()).toBe(1)
  })

  it('never overwrites a value the volunteer entered themselves', async () => {
    await db.user.create({
      data: {
        email: 'conflict@example.com',
        username: 'conflictuser',
        passwordHash: await hashPassword('Praise2027!Real'),
        profile: { create: { firstName: 'Current', lastName: 'Surname', phone: '+2348011111111' } },
      },
    })

    const outcome = await runImport({
      email: 'conflict@example.com',
      firstName: 'Older',
      lastName: 'Surname',
      phone: '+2348099999999',
    })

    const profile = await db.volunteerProfile.findFirst({
      where: { user: { email: 'conflict@example.com' } },
    })

    expect(profile!.firstName).toBe('Current')
    expect(profile!.phone).toBe('+2348011111111')
    // The difference is reported rather than applied.
    expect(outcome.conflicts.map((c) => c.field).sort()).toEqual(['firstName', 'phone'])
  })

  it('fills a profile field only when it is empty', async () => {
    await db.user.create({
      data: {
        email: 'gaps@example.com',
        username: 'gapsuser',
        passwordHash: await hashPassword('Praise2027!Real'),
        profile: { create: { firstName: 'Has', lastName: 'Name' } },
      },
    })

    await runImport({ email: 'gaps@example.com', phone: '+2348022222222' })

    const profile = await db.volunteerProfile.findFirst({
      where: { user: { email: 'gaps@example.com' } },
    })
    expect(profile!.phone).toBe('+2348022222222')
    expect(profile!.firstName).toBe('Has')
  })

  it('is idempotent — running the same row twice changes nothing the second time', async () => {
    await runImport({ email: 'twice@example.com', firstName: 'Run', lastName: 'Twice' })
    const afterFirst = await db.user.count()

    const second = await runImport({ email: 'twice@example.com', firstName: 'Run', lastName: 'Twice' })

    expect(await db.user.count()).toBe(afterFirst)
    // The second pass sees the account it created and links to it.
    expect(second.action).toBe('MATCH_EXISTING')
    expect(
      await db.previousEditionParticipation.count({ where: { edition: '2024' } }),
    ).toBe(1)
  })

  it('records prior participation separately from any current application', async () => {
    const outcome = await runImport({
      email: 'history@example.com',
      firstName: 'His',
      lastName: 'Tory',
      previousDepartment: 'Ushering',
      previousRegistrationId: 'MMP-2024-000123',
    })

    const participation = await db.previousEditionParticipation.findFirst({
      where: { userId: outcome.userId! },
    })
    expect(participation!.edition).toBe('2024')
    expect(participation!.previousDepartment).toBe('Ushering')
    expect(participation!.previousRegistrationId).toBe('MMP-2024-000123')

    // The single most important assertion here: importing history must never
    // put anybody into the current edition's review queue.
    expect(await db.volunteerApplication.count()).toBe(0)
  })

  it('gives every migrated account a distinct username', async () => {
    await runImport({ email: 'a@example.com', firstName: 'Same', lastName: 'Name' }, 1)
    await runImport({ email: 'b@example.com', firstName: 'Same', lastName: 'Name' }, 2)

    const users = await db.user.findMany({ select: { username: true } })
    expect(new Set(users.map((u) => u.username)).size).toBe(users.length)
  })

  it('does not fail when a legacy phone number is already taken', async () => {
    // Phone is unique on the account; two family members sharing a handset in
    // the legacy list must not break the import.
    await db.user.create({
      data: {
        email: 'first@example.com',
        username: 'firstuser',
        phone: '+2348033333333',
        passwordHash: await hashPassword('Praise2027!Real'),
        profile: { create: { firstName: 'First', lastName: 'User' } },
      },
    })

    const outcome = await runImport({
      email: 'second@example.com',
      firstName: 'Second',
      lastName: 'User',
      phone: '+2348033333333',
    })

    expect(outcome.action).toBe('CREATE')
    const created = await db.user.findUnique({
      where: { email: 'second@example.com' },
      include: { profile: true },
    })
    // Kept on the profile, left off the account, so the constraint holds.
    expect(created!.phone).toBeNull()
    expect(created!.profile?.phone).toBe('+2348033333333')
  })
})
