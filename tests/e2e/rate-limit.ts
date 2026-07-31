import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env' })
config({ path: '.env.local', override: true })

/**
 * Reset security counters between end-to-end tests.
 *
 * Registration is limited to a handful of attempts per IP per hour, and repeated
 * bad passwords lock an account — both correct in production, but the whole
 * suite runs from one address. Plain SQL is used rather than the Prisma client
 * because Playwright transpiles these files to CommonJS, which the generated
 * ESM client cannot be loaded from.
 */
async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T | undefined> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return undefined

  const client = new Client({ connectionString })
  try {
    await client.connect()
    return await run(client)
  } catch (error) {
    console.warn('[e2e] could not reset security counters:', (error as Error).message)
    return undefined
  } finally {
    await client.end().catch(() => undefined)
  }
}

export async function clearRateLimits() {
  await withClient((client) => client.query('DELETE FROM rate_limit_buckets'))
}

export async function unlockAccounts() {
  await withClient((client) =>
    client.query('UPDATE users SET "lockedUntil" = NULL, "failedLogins" = 0 WHERE "lockedUntil" IS NOT NULL'),
  )
}
