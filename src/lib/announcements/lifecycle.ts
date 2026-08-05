import 'server-only'
import { db } from '@/lib/db'

/**
 * Advance announcements whose clock has struck.
 *
 * Scheduling and expiry are lazy: instead of a background worker watching the
 * clock, any page that is about to *read* announcements first promotes the due
 * ones. The [status, scheduledFor] index makes both statements a no-op in the
 * common case, and the state a reader sees is always consistent with the time
 * of their request — which is all a scheduler would buy, without owning a
 * process. (The roadmap's worker pass is still wanted for one thing this
 * cannot do: sending a *scheduled* announcement's email at the moment it goes
 * live. Until then, email goes out on immediate publish only.)
 *
 * `publishedAt` is set to `scheduledFor`, not `now()`: the announcement went
 * live the moment its schedule said, whether or not anyone was looking.
 */
export async function promoteDueAnnouncements(): Promise<void> {
  await db.$executeRaw`
    UPDATE "announcements"
    SET "status" = 'PUBLISHED',
        "publishedAt" = COALESCE("publishedAt", "scheduledFor"),
        "updatedAt" = now()
    WHERE "status" = 'SCHEDULED' AND "scheduledFor" <= now()`
  await db.$executeRaw`
    UPDATE "announcements"
    SET "status" = 'EXPIRED', "updatedAt" = now()
    WHERE "status" = 'PUBLISHED' AND "expiresAt" IS NOT NULL AND "expiresAt" <= now()`
}
