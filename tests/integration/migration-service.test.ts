import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ensureSeedData,
  hasTestDatabase,
  migrateTestDatabase,
  resetVolunteerData,
  testDb,
} from '../helpers/db'
import { toCsv } from '@/lib/migration/csv'

/**
 * The migration service, against a real database.
 *
 * These cover the part an administrator actually drives — upload, validate,
 * confirm — and the properties that make it safe to press twice:
 *
 *  - Validating writes verdicts, never volunteer records. A dry run is dry.
 *  - The same file twice for the same edition is refused before anything is
 *    written, so nobody double-imports or double-invites.
 *  - Confirming twice enqueues the work once.
 *  - Invitations are never queued for somebody who already has an account.
 */
const describeDb = hasTestDatabase ? describe : describe.skip

describeDb('migration service', () => {
  const db = hasTestDatabase ? testDb() : (null as never)

  beforeAll(async () => {
    migrateTestDatabase()
    await ensureSeedData()
  }, 120_000)

  beforeEach(async () => {
    await resetVolunteerData()
  })

  /** A CSV with a header row and the rows given. */
  function csv(rows: [string, string, string][]): Buffer {
    return Buffer.from(toCsv(['Email', 'First name', 'Last name'], rows), 'utf8')
  }

  async function upload(bytes: Buffer, edition = '84 Hours 2026') {
    const { createBatch } = await import('@/lib/migration/service')
    return createBatch({
      file: { name: 'legacy.csv', bytes },
      name: 'Test import',
      sourceEdition: edition,
      sourceYear: 2026,
      sourceNote: null,
      sendInvitations: false,
      actorId: null as unknown as string,
    })
  }

  it('rejects a file with no data rows before storing anything', async () => {
    const result = await upload(Buffer.from('Email,First name,Last name\r\n', 'utf8'))
    expect(result.ok).toBe(false)
    expect(await db.migrationBatch.count()).toBe(0)
  })

  it('refuses the same file twice for the same edition', async () => {
    const bytes = csv([['a@example.com', 'A', 'One']])

    const first = await upload(bytes)
    expect(first.ok).toBe(true)

    const second = await upload(bytes)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error).toMatch(/already been uploaded/i)

    // The guard is what stops a nervous administrator double-importing.
    expect(await db.migrationBatch.count()).toBe(1)
  })

  it('allows the same file for a different edition', async () => {
    const bytes = csv([['a@example.com', 'A', 'One']])
    expect((await upload(bytes, '2024')).ok).toBe(true)
    expect((await upload(bytes, '2025')).ok).toBe(true)
    expect(await db.migrationBatch.count()).toBe(2)
  })

  it('validates without creating a single volunteer record', async () => {
    const { validateBatch } = await import('@/lib/migration/service')

    const uploaded = await upload(
      csv([
        ['grace@example.com', 'Grace', 'Adeyemi'],
        ['not-an-email', 'Broken', 'Row'],
        ['grace@example.com', 'Grace', 'Duplicate'],
      ]),
    )
    expect(uploaded.ok).toBe(true)
    if (!uploaded.ok) return

    const result = await validateBatch({ batchId: uploaded.batchId, actorId: null as never })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.summary.total).toBe(3)
    expect(result.summary.invalid).toBe(1)
    expect(result.summary.duplicateInFile).toBe(1)
    expect(result.summary.willCreate).toBe(1)

    // The whole point: verdicts exist, people do not.
    expect(await db.migratedUserRecord.count()).toBe(3)
    expect(await db.user.count()).toBe(0)
    expect(await db.volunteerProfile.count()).toBe(0)
    expect(await db.previousEditionParticipation.count()).toBe(0)
  })

  it('marks a row that already has an account as a match, not a new person', async () => {
    const { validateBatch } = await import('@/lib/migration/service')

    await db.user.create({
      data: { email: 'existing@example.com', username: 'existing', passwordHash: 'x' },
    })

    const uploaded = await upload(csv([['existing@example.com', 'Existing', 'Person']]))
    expect(uploaded.ok).toBe(true)
    if (!uploaded.ok) return

    const result = await validateBatch({ batchId: uploaded.batchId, actorId: null as never })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.summary.willMatch).toBe(1)
    expect(result.summary.willCreate).toBe(0)

    const record = await db.migratedUserRecord.findFirst({ where: { batchId: uploaded.batchId } })
    expect(record?.action).toBe('MATCH_EXISTING')
  })

  it('re-validating replaces the previous verdicts rather than adding to them', async () => {
    const { validateBatch } = await import('@/lib/migration/service')

    const uploaded = await upload(csv([['a@example.com', 'A', 'One']]))
    if (!uploaded.ok) return

    await validateBatch({ batchId: uploaded.batchId, actorId: null as never })
    await validateBatch({ batchId: uploaded.batchId, actorId: null as never })

    expect(await db.migratedUserRecord.count({ where: { batchId: uploaded.batchId } })).toBe(1)
  })

  it('refuses to queue an import that has not been validated', async () => {
    const { queueImport } = await import('@/lib/migration/service')

    const uploaded = await upload(csv([['a@example.com', 'A', 'One']]))
    if (!uploaded.ok) return

    const result = await queueImport({ batchId: uploaded.batchId, actorId: null as never })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/validate/i)
    expect(await db.importJob.count()).toBe(0)
  })

  it('queues the work once however many times confirm is pressed', async () => {
    const { queueImport, validateBatch } = await import('@/lib/migration/service')

    const uploaded = await upload(csv([['a@example.com', 'A', 'One']]))
    if (!uploaded.ok) return
    await validateBatch({ batchId: uploaded.batchId, actorId: null as never })

    const first = await queueImport({ batchId: uploaded.batchId, actorId: null as never })
    expect(first.ok).toBe(true)
    const jobsAfterFirst = await db.importJob.count()

    // The second press is rejected by the status guard, and even if it were
    // not, `(batchId, kind, offset)` is unique.
    const second = await queueImport({ batchId: uploaded.batchId, actorId: null as never })
    expect(second.ok).toBe(false)
    expect(await db.importJob.count()).toBe(jobsAfterFirst)
  })

  it('imports through the queue, then invites only the accounts it created', async () => {
    const { queueImport, queueInvitations, validateBatch } = await import('@/lib/migration/service')
    const { runQueue } = await import('@/lib/migration/worker')

    await db.user.create({
      data: { email: 'known@example.com', username: 'known', passwordHash: 'x' },
    })

    const uploaded = await upload(
      csv([
        ['fresh@example.com', 'Fresh', 'Person'],
        ['known@example.com', 'Known', 'Person'],
      ]),
    )
    if (!uploaded.ok) return

    await validateBatch({ batchId: uploaded.batchId, actorId: null as never })
    await queueImport({ batchId: uploaded.batchId, actorId: null as never })
    await runQueue({ maxJobs: 10 })

    const batch = await db.migrationBatch.findUniqueOrThrow({ where: { id: uploaded.batchId } })
    expect(batch.createdRows).toBe(1)
    expect(batch.matchedRows).toBe(1)
    expect(['COMPLETED', 'COMPLETED_WITH_WARNINGS']).toContain(batch.status)

    // Two people, two participation records, and no second account for the
    // person who already had one.
    expect(await db.user.count()).toBe(2)
    expect(await db.previousEditionParticipation.count()).toBe(2)

    const invited = await queueInvitations({ batchId: uploaded.batchId, actorId: null as never })
    expect(invited.ok).toBe(true)
    // Only the created account. Telling somebody who can already sign in to
    // reset their password is both confusing and a phishing lookalike.
    if (invited.ok) expect(invited.queued).toBe(1)

    const queued = await db.migratedUserRecord.findMany({
      where: { batchId: uploaded.batchId, invitationStatus: 'QUEUED' },
    })
    expect(queued).toHaveLength(1)
    expect(queued[0]!.normalisedEmail).toBe('fresh@example.com')
  })

  it('never writes a current-edition application for a migrated person', async () => {
    const { queueImport, validateBatch } = await import('@/lib/migration/service')
    const { runQueue } = await import('@/lib/migration/worker')

    const uploaded = await upload(csv([['history@example.com', 'History', 'Person']]))
    if (!uploaded.ok) return

    await validateBatch({ batchId: uploaded.batchId, actorId: null as never })
    await queueImport({ batchId: uploaded.batchId, actorId: null as never })
    await runQueue({ maxJobs: 10 })

    /*
     * Representing history as a current application would put someone in a
     * review queue they never joined and inflate every figure on the admin
     * dashboard. It is the single most damaging thing this import could do.
     */
    expect(await db.volunteerApplication.count()).toBe(0)
    expect(await db.previousEditionParticipation.count()).toBe(1)
  })

  it('produces a report of the rows that could not be imported', async () => {
    const { failedRowsCsv, validateBatch } = await import('@/lib/migration/service')

    const uploaded = await upload(
      csv([
        ['good@example.com', 'Good', 'Row'],
        ['broken', 'Bad', 'Row'],
      ]),
    )
    if (!uploaded.ok) return
    await validateBatch({ batchId: uploaded.batchId, actorId: null as never })

    const report = await failedRowsCsv(uploaded.batchId)
    expect(report).toContain('broken')
    expect(report).not.toContain('good@example.com')
    expect(report).toMatch(/not valid/i)
  })

  it('neutralises a formula in the failed-row report', async () => {
    const { failedRowsCsv, validateBatch } = await import('@/lib/migration/service')

    // A name a spreadsheet would execute on open. The report is opened in Excel
    // by definition, so the value must go out as text.
    const uploaded = await upload(csv([['not-an-email', '=cmd|calc', 'Row']]))
    if (!uploaded.ok) return
    await validateBatch({ batchId: uploaded.batchId, actorId: null as never })

    const report = await failedRowsCsv(uploaded.batchId)
    expect(report).toContain("'=cmd|calc")
    expect(report).not.toMatch(/(^|,)"=cmd/)
  })
})

describeDb('phase 2 — identity, enums and per-row edition', () => {
  const db = hasTestDatabase ? testDb() : (null as never)

  beforeAll(async () => {
    migrateTestDatabase()
    await ensureSeedData()
  }, 120_000)

  beforeEach(async () => {
    await resetVolunteerData()
  })

  /** A CSV shaped like the real merged export, with the Phase 2 columns. */
  function legacyCsv(rows: string[][]): Buffer {
    return Buffer.from(
      toCsv(
        ['Email', 'First name', 'Last name', 'MMP number', 'Username', 'Age band', 'Gender', 'Denomination', 'Edition'],
        rows,
      ),
      'utf8',
    )
  }

  async function runFullImport(bytes: Buffer, edition = 'legacy-mixed') {
    const { createBatch, queueImport, validateBatch } = await import('@/lib/migration/service')
    const { runQueue } = await import('@/lib/migration/worker')
    const up = await createBatch({
      file: { name: 'legacy.csv', bytes },
      name: 'Phase 2 test',
      sourceEdition: edition,
      sourceYear: null,
      sourceNote: null,
      sendInvitations: false,
      actorId: null as never,
    })
    if (!up.ok) throw new Error(up.error)
    await validateBatch({ batchId: up.batchId, actorId: null as never })
    await queueImport({ batchId: up.batchId, actorId: null as never })
    await runQueue({ maxJobs: 10 })
    return up.batchId
  }

  it('honours the legacy MMP number, username and translated enums', async () => {
    await runFullImport(
      legacyCsv([
        ['grace@example.com', 'Grace', 'Adeyemi', 'MMP2203417', 'Bbgold', '21-25', 'Female', 'RCCG', '2025'],
      ]),
    )

    const user = await db.user.findUniqueOrThrow({
      where: { email: 'grace@example.com' },
      include: { profile: true },
    })

    // The identity they already have, kept: their code, their username.
    expect(user.mmpCode).toBe('MMP2203417')
    expect(user.username).toBe('bbgold')
    // The enums, translated — never the display text.
    expect(user.profile?.ageRange).toBe('AGE_21_25')
    expect(user.profile?.gender).toBe('FEMALE')
    expect(user.profile?.denomination).toBe('RCCG')
  })

  it('records each person against their own edition, not the batch label', async () => {
    await runFullImport(
      legacyCsv([
        ['y2022@example.com', 'A', 'One', 'MMP2200100', 'atwentytwo', '21-25', 'Male', 'RCCG', '2022'],
        ['y2026@example.com', 'B', 'Two', 'MMP2213000', 'btwentysix', '26-30', 'Female', 'RCCG', '2026'],
      ]),
    )

    const participations = await db.previousEditionParticipation.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { edition: 'asc' },
    })
    expect(participations.map((p) => [p.user.email, p.edition, p.year])).toEqual([
      ['y2022@example.com', '2022', 2022],
      ['y2026@example.com', '2026', 2026],
    ])
  })

  it('falls back safely when the legacy code or username is unusable', async () => {
    // First import claims the code and the username.
    await runFullImport(
      legacyCsv([
        ['first@example.com', 'First', 'Holder', 'MMP2203417', 'sharedname', '21-25', 'Male', 'RCCG', '2024'],
      ]),
      'first-batch',
    )
    // Second person arrives with the same code and username — a data-entry
    // error in the legacy system, not a licence to merge two people.
    await runFullImport(
      legacyCsv([
        ['second@example.com', 'Second', 'Person', 'MMP2203417', 'sharedname', '26-30', 'Female', 'RCCG', '2024'],
      ]),
      'second-batch',
    )

    const second = await db.user.findUniqueOrThrow({ where: { email: 'second@example.com' } })
    // A fresh code from the sequence, never a duplicate, never a failure.
    expect(second.mmpCode).not.toBe('MMP2203417')
    expect(second.mmpCode).toMatch(/^MMP\d{7}$/)
    expect(Number(second.mmpCode!.slice(3))).toBeGreaterThanOrEqual(2214059)
    expect(second.username).not.toBe('sharedname')

    // Both people imported; nothing failed.
    const failed = await db.migratedUserRecord.count({ where: { status: 'FAILED' } })
    expect(failed).toBe(0)
  })

  it('keeps unrecognised enum values out of the profile but in the record', async () => {
    const batchId = await runFullImport(
      legacyCsv([
        ['odd@example.com', 'Odd', 'Values', 'MMP2205000', 'oddvalues', '18-24', 'Other', 'Baptist', '2023'],
      ]),
    )

    const user = await db.user.findUniqueOrThrow({
      where: { email: 'odd@example.com' },
      include: { profile: true },
    })
    // Dropped, never guessed.
    expect(user.profile?.ageRange).toBeNull()
    expect(user.profile?.gender).toBeNull()
    expect(user.profile?.denomination).toBeNull()

    // The dry run flagged all three for a human.
    const record = await db.migratedUserRecord.findFirstOrThrow({ where: { batchId } })
    const fields = (record.validationMessages as { field: string }[]).map((m) => m.field)
    expect(fields).toEqual(expect.arrayContaining(['ageRange', 'gender', 'denomination']))
    // And the original text survives on the participation for later correction.
    const participation = await db.previousEditionParticipation.findFirstOrThrow({
      where: { userId: user.id },
    })
    expect((participation.metadata as Record<string, string>).ageRange).toBe('18-24')
  })
})
