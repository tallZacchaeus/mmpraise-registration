import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import { Client } from 'pg'
import { hashPassword } from '../../src/lib/auth/password'

config({ path: '.env' })
config({ path: '.env.local', override: true })

/**
 * Create a signed-up volunteer directly in the database.
 *
 * The dashboard suite used to reach its fixture by filling in the sign-up form.
 * That made every dashboard assertion depend on registration succeeding, and
 * registration is rate limited per IP by design — a suite that runs three
 * projects from one address exhausts the allowance and then fails with
 * "username already taken" for a username that is provably unique, because the
 * *account was created* and only the client-side redirect was lost.
 *
 * Those were never dashboard failures. Creating the row here removes the
 * sign-up form, its rate limit and its redirect from a suite that is not
 * testing any of them. Registration itself is still covered end to end by
 * tests/e2e/registration.spec.ts, which is where that belongs.
 *
 * Plain SQL rather than the Prisma client: Playwright transpiles these files to
 * CommonJS, which the generated ESM client cannot be loaded from. `hashPassword`
 * is safe to import because it uses nothing but `node:crypto`.
 */
export type SeededVolunteer = {
  email: string
  username: string
  password: string
  firstName: string
  lastName: string
  /** The permanent MMP number, allocated from the same sequence the app uses. */
  mmpCode: string
}

export async function seedVolunteer(prefix = 'dash'): Promise<SeededVolunteer> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const stamp = randomUUID().replace(/-/g, '').slice(0, 16)
  const volunteer: SeededVolunteer = {
    email: `${prefix}.${stamp}@example.com`,
    username: `${prefix}${stamp}`.slice(0, 30),
    password: 'Praise2027!Dash',
    firstName: 'Test',
    lastName: 'Volunteer',
    mmpCode: '',
  }

  const passwordHash = await hashPassword(volunteer.password)
  const userId = `u_${stamp}`

  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    // Drawn from the real sequence rather than made up, so the fixture cannot
    // collide with an account the application itself created.
    const seq = await client.query(`SELECT nextval('mmp_code_seq') AS v`)
    volunteer.mmpCode = `MMP${String(seq.rows[0].v).padStart(7, '0')}`

    await client.query(
      `INSERT INTO users (id, email, username, "passwordHash", "mmpCode", "emailVerifiedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now(), now(), now())`,
      [userId, volunteer.email, volunteer.username, passwordHash, volunteer.mmpCode],
    )
    await client.query(
      `INSERT INTO user_roles (id, "userId", role) VALUES ($1, $2, 'VOLUNTEER')`,
      [`r_${stamp}`, userId],
    )
    await client.query(
      `INSERT INTO volunteer_profiles (id, "userId", "firstName", "lastName", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, now(), now())`,
      [`p_${stamp}`, userId, volunteer.firstName, volunteer.lastName],
    )
    /*
     * The draft the wizard would have created on first visit. Seeding it here
     * means the dashboard is exercised in the state it is actually met in —
     * `currentStep` 1, nothing saved — rather than in the rarer "no application
     * row at all" state.
     */
    await client.query(
      `INSERT INTO volunteer_applications (id, "registrationId", "userId", status, "currentStep", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'DRAFT', 1, now(), now())`,
      [`a_${stamp}`, `DRAFT-${userId}`, userId],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }

  return volunteer
}


/**
 * A volunteer from a previous edition: registered, approved, but with no
 * confirmed participation for the current one — exactly the state every
 * returning volunteer is in the day a new edition opens.
 *
 * The unconfirmed 2027 row is deliberately absent rather than blank: the
 * dashboard must handle "no row yet" because that is what a genuine edition
 * rollover produces.
 */
export async function seedReturningVolunteer(prefix = 'return'): Promise<SeededVolunteer> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const stamp = randomUUID().replace(/-/g, '').slice(0, 16)
  const volunteer: SeededVolunteer = {
    email: `${prefix}.${stamp}@example.com`,
    username: `${prefix}${stamp}`.slice(0, 30),
    password: 'Praise2027!Dash',
    firstName: 'Returning',
    lastName: 'Volunteer',
    mmpCode: '',
  }

  const passwordHash = await hashPassword(volunteer.password)
  const userId = `u_${stamp}`

  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    const seq = await client.query(`SELECT nextval('mmp_code_seq') AS v`)
    volunteer.mmpCode = `MMP${String(seq.rows[0].v).padStart(7, '0')}`

    await client.query(
      `INSERT INTO users (id, email, username, "passwordHash", "mmpCode", "emailVerifiedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now(), now(), now())`,
      [userId, volunteer.email, volunteer.username, passwordHash, volunteer.mmpCode],
    )
    await client.query(`INSERT INTO user_roles (id, "userId", role) VALUES ($1, $2, 'VOLUNTEER')`, [
      `r_${stamp}`,
      userId,
    ])
    await client.query(
      `INSERT INTO volunteer_profiles (id, "userId", "firstName", "lastName", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, now(), now())`,
      [`p_${stamp}`, userId, volunteer.firstName, volunteer.lastName],
    )
    // Registered and approved once — the one-time judgement, already made.
    await client.query(
      `INSERT INTO volunteer_applications (id, "registrationId", "userId", status, "currentStep", "submittedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'APPROVED', 8, now() - interval '1 year', now() - interval '1 year', now())`,
      [`a_${stamp}`, `MMP-2026-9${stamp.slice(0, 5)}`, userId],
    )
    // Their history: a completed earlier edition, department Welfare if seeded.
    const dept = await client.query(`SELECT id FROM departments WHERE slug = 'welfare' LIMIT 1`)
    await client.query(
      `INSERT INTO edition_participations (id, "applicationId", edition, year, "departmentId", status, "confirmedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, '2026', 2026, $3, 'COMPLETED', now() - interval '1 year', now() - interval '1 year', now())`,
      [`ep26_${stamp}`, `a_${stamp}`, dept.rows[0]?.id ?? null],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }

  return volunteer
}


/**
 * A volunteer whose application is SUBMITTED and awaiting review — the state
 * the bulk-approve flow consumes. Confirmed participation included, so the
 * row also renders a department in the applicants list.
 */
export async function seedSubmittedVolunteer(prefix = 'subm'): Promise<SeededVolunteer> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const stamp = randomUUID().replace(/-/g, '').slice(0, 16)
  const volunteer: SeededVolunteer = {
    email: `${prefix}.${stamp}@example.com`,
    username: `${prefix}${stamp}`.slice(0, 30),
    password: 'Praise2027!Dash',
    firstName: 'Submitted',
    lastName: 'Volunteer',
    mmpCode: '',
  }

  const passwordHash = await hashPassword(volunteer.password)
  const userId = `u_${stamp}`

  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    const seq = await client.query(`SELECT nextval('mmp_code_seq') AS v`)
    volunteer.mmpCode = `MMP${String(seq.rows[0].v).padStart(7, '0')}`

    await client.query(
      `INSERT INTO users (id, email, username, "passwordHash", "mmpCode", "emailVerifiedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now(), now(), now())`,
      [userId, volunteer.email, volunteer.username, passwordHash, volunteer.mmpCode],
    )
    await client.query(`INSERT INTO user_roles (id, "userId", role) VALUES ($1, $2, 'VOLUNTEER')`, [
      `r_${stamp}`,
      userId,
    ])
    await client.query(
      `INSERT INTO volunteer_profiles (id, "userId", "firstName", "lastName", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, now(), now())`,
      [`p_${stamp}`, userId, volunteer.firstName, volunteer.lastName],
    )
    await client.query(
      `INSERT INTO volunteer_applications (id, "registrationId", "userId", status, "currentStep", "submittedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'SUBMITTED', 8, now() - interval '10 days 12 hours', now() - interval '10 days 12 hours', now())`,
      [`a_${stamp}`, `MMP-2027-8${stamp.slice(0, 5)}`, userId],
    )
    const dept = await client.query(`SELECT id FROM departments WHERE slug = 'welfare' LIMIT 1`)
    await client.query(
      `INSERT INTO edition_participations (id, "applicationId", edition, year, "departmentId", status, "confirmedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, '2027', 2027, $3, 'SIGNED_UP', now() - interval '10 days', now(), now())`,
      [`ep_${stamp}`, `a_${stamp}`, dept.rows[0]?.id ?? null],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }

  return volunteer
}

/**
 * A testimony submission, written straight to the database.
 *
 * The body hash uses the same module the application writes with, so the
 * duplicate detection under test is the real rule, not a copy of it.
 */
/**
 * A contact message, written straight to the database.
 *
 * As with testimonies, the message hash comes from the shared module so the
 * duplicate grouping under test is the application's real rule.
 */
export async function seedContactMessage(options: {
  prefix?: string
  message: string
  subject?: string
  name?: string
  email?: string
  isTestData?: boolean
}): Promise<{ id: string; email: string; subject: string }> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const { normalisedBodyHash } = await import('../../src/lib/testimonies/hash')
  const stamp = randomUUID().replace(/-/g, '').slice(0, 12)
  const id = `cm_${stamp}`
  const subject = options.subject ?? `Enquiry ${stamp}`
  const email = options.email ?? `${options.prefix ?? 'ask'}.${stamp}@example.org`

  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query(
      `INSERT INTO contact_messages
         (id, category, name, email, subject, message, status, priority,
          "messageHash", "isTestData", "createdAt", "updatedAt")
       VALUES ($1, 'GENERAL', $2, $3, $4, $5, 'NEW', 'NORMAL', $6, $7, now(), now())`,
      [
        id,
        options.name ?? 'Kemi Balogun',
        email,
        subject,
        options.message,
        normalisedBodyHash(options.message),
        options.isTestData ?? false,
      ],
    )
  } finally {
    await client.end().catch(() => undefined)
  }

  return { id, email, subject }
}

export async function seedTestimony(options: {
  prefix?: string
  body: string
  title?: string
  authorName?: string
  isTestData?: boolean
}): Promise<{ id: string; email: string; title: string }> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const { testimonyBodyHash } = await import('../../src/lib/testimonies/hash')
  const stamp = randomUUID().replace(/-/g, '').slice(0, 12)
  const id = `t_${stamp}`
  const title = options.title ?? `Praise report ${stamp}`
  const email = `${options.prefix ?? 'story'}.${stamp}@example.org`

  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query(
      `INSERT INTO testimony_submissions
         (id, title, body, "authorName", email, country, "isAnonymous", "consentToPublish",
          status, "bodyHash", "isTestData", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'Nigeria', false, true, 'PENDING', $6, $7, now(), now())`,
      [
        id,
        title,
        options.body,
        options.authorName ?? 'Grace Adeyemi',
        email,
        testimonyBodyHash(options.body),
        options.isTestData ?? false,
      ],
    )
  } finally {
    await client.end().catch(() => undefined)
  }

  return { id, email, title }
}
