import { execSync } from 'node:child_process'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

/**
 * Test-database helper.
 *
 * Integration tests run against TEST_DATABASE_URL, never the development
 * database. Each suite wipes the tables it touches so runs are repeatable.
 */
export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL)

let client: PrismaClient | null = null

export function testDb(): PrismaClient {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set')
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) })
  }
  return client
}

/** Bring the test database up to date with the current migrations. */
export function migrateTestDatabase() {
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  })
}

/** Remove volunteer data, leaving reference data in place. */
export async function resetVolunteerData() {
  const db = testDb()
  await db.applicationAnswerOption.deleteMany({})
  await db.applicationAnswer.deleteMany({})
  await db.applicationHealthInfo.deleteMany({})
  await db.emergencyContact.deleteMany({})
  await db.volunteerAvailability.deleteMany({})
  await db.shiftAssignment.deleteMany({})
  await db.adminNote.deleteMany({})
  await db.applicationStatusHistory.deleteMany({})
  await db.volunteerApplication.deleteMany({})
  await db.volunteerDocument.deleteMany({})
  await db.volunteerProfile.deleteMany({})
  await db.session.deleteMany({})
  await db.verificationToken.deleteMany({})
  await db.previousEditionParticipation.deleteMany({})
  await db.migratedUserRecord.deleteMany({})
  await db.importJob.deleteMany({})
  await db.migrationBatch.deleteMany({})
  await db.userDepartmentScope.deleteMany({})
  await db.userRole.deleteMany({})
  await db.auditLog.deleteMany({})
  await db.user.deleteMany({})
  await db.rateLimitBucket.deleteMany({})
}

/** Ensure the reference data the tests rely on exists. */
export async function ensureSeedData() {
  const db = testDb()
  const departments = await db.department.count()
  if (departments === 0) {
    execSync('npx tsx prisma/seed.ts', {
      stdio: 'ignore',
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    })
  }
}
