import 'server-only'
import { eventConfig } from '@/config/site'
import { db } from '@/lib/db'
import { can } from '@/lib/auth/rbac'
import type { SessionUser } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'

/**
 * Everything the admin overview shows, gathered in one place.
 *
 * The page's job is operational: *what needs doing, and how big is it?* So the
 * shape here is organised by question, not by table — and every count that an
 * administrator can act on carries the href of the filtered view that resolves
 * it, because a number nobody can click is decoration.
 *
 * Sections are permission-gated at this layer, not in the JSX: a department
 * head's overview simply contains no migration block, rather than an empty one
 * the template has to hide.
 */

export type AttentionItem = {
  id: string
  label: string
  count: number
  href: string
  /** How urgent the queue is when non-empty. */
  tone: 'warning' | 'danger' | 'info'
}

export type OverviewData = Awaited<ReturnType<typeof getOverview>>

export async function getOverview(user: SessionUser) {
  const edition = eventConfig.edition
  const settings = await getSettings()

  /*
   * The split model reports two lifecycles, and conflating them again here
   * would undo the point of the split:
   *
   *  - the **application** lifecycle — one-time standing (submitted → approved)
   *  - the **participation** lifecycle — this edition (signed up → completed)
   */
  const [applicationsByStatus, participationsByStatus, unconfirmed, submittedThisWeek] =
    await Promise.all([
      db.volunteerApplication.groupBy({ by: ['status'], _count: { _all: true } }),
      db.editionParticipation.groupBy({
        by: ['status'],
        where: { edition, confirmedAt: { not: null } },
        _count: { _all: true },
      }),
      // Registered volunteers who have not yet said "I am coming this edition"
      // — the number the whole activation campaign exists to drive down.
      db.volunteerApplication.count({
        where: {
          status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'WAITLISTED'] },
          participations: { none: { edition, confirmedAt: { not: null } } },
        },
      }),
      db.volunteerApplication.count({
        where: { submittedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      }),
    ])

  const appCount = (status: string) =>
    applicationsByStatus.find((row) => row.status === status)?._count._all ?? 0
  const partCount = (status: string) =>
    participationsByStatus.find((row) => row.status === status)?._count._all ?? 0

  const awaitingReview = appCount('SUBMITTED') + appCount('UNDER_REVIEW')

  // ------------------------------------------------------------- migration
  const showMigration = can(user, 'migration:view')
  const migration = showMigration
    ? await (async () => {
        const [imported, activated, reviewed, invites, failedRows, runningBatches] =
          await Promise.all([
            db.user.count({ where: { isPreviousEditionUser: true } }),
            db.user.count({
              where: { isPreviousEditionUser: true, emailVerifiedAt: { not: null } },
            }),
            db.user.count({
              where: { isPreviousEditionUser: true, profileReviewedAt: { not: null } },
            }),
            db.migratedUserRecord.groupBy({ by: ['invitationStatus'], _count: { _all: true } }),
            db.migratedUserRecord.count({ where: { status: 'FAILED' } }),
            db.migrationBatch.count({ where: { status: { in: ['QUEUED', 'IMPORTING'] } } }),
          ])
        const invite = (status: string) =>
          invites.find((row) => row.invitationStatus === status)?._count._all ?? 0
        return {
          imported,
          activated,
          reviewed,
          invitesSent: invite('SENT') + invite('DELIVERED'),
          invitesFailed: invite('FAILED') + invite('BOUNCED'),
          failedRows,
          runningBatches,
        }
      })()
    : null

  // ---------------------------------------------------------- communications
  const showComms = can(user, 'application:view_all')
  const comms = showComms
    ? await (async () => {
        const [newMessages, pendingTestimonies, failedEmails] = await Promise.all([
          db.contactMessage.count({ where: { status: 'NEW' } }),
          db.testimonySubmission.count({ where: { status: 'PENDING' } }),
          db.migratedUserRecord.count({ where: { invitationStatus: { in: ['FAILED', 'BOUNCED'] } } }),
        ])
        return { newMessages, pendingTestimonies, failedEmails }
      })()
    : null

  // ---------------------------------------------------------- needs attention
  /*
   * Only queues that are non-empty appear, ordered by severity. An empty
   * "needs attention" list is itself the message — it renders as "nothing is
   * waiting on you", which is the sentence every operational dashboard is
   * trying to earn.
   */
  const needsAttention: AttentionItem[] = []
  if (awaitingReview > 0) {
    needsAttention.push({
      id: 'review',
      label: 'applications awaiting review',
      count: awaitingReview,
      href: '/admin/applications?status=SUBMITTED',
      tone: 'warning',
    })
  }
  if (migration && migration.failedRows > 0) {
    needsAttention.push({
      id: 'failed-rows',
      label: 'import rows failed',
      count: migration.failedRows,
      href: '/admin/previous-participants',
      tone: 'danger',
    })
  }
  if (migration && migration.invitesFailed > 0) {
    needsAttention.push({
      id: 'failed-invites',
      label: 'invitations failed or bounced',
      count: migration.invitesFailed,
      href: '/admin/previous-participants',
      tone: 'danger',
    })
  }
  if (comms && comms.newMessages > 0) {
    needsAttention.push({
      id: 'messages',
      label: 'unanswered messages',
      count: comms.newMessages,
      href: '/admin/messages',
      tone: 'warning',
    })
  }
  if (comms && comms.pendingTestimonies > 0) {
    needsAttention.push({
      id: 'testimonies',
      label: 'testimonies awaiting moderation',
      count: comms.pendingTestimonies,
      href: '/admin/testimonies',
      tone: 'info',
    })
  }

  // ------------------------------------------------------------ distributions
  const [byDepartment, byCountry, byAgeRange, departments] = await Promise.all([
    db.editionParticipation.groupBy({
      by: ['departmentId'],
      where: { edition, application: { status: { not: 'DRAFT' } } },
      _count: { _all: true },
    }),
    db.volunteerProfile.groupBy({
      by: ['countryId'],
      where: { user: { applications: { some: { status: { not: 'DRAFT' } } } } },
      _count: { _all: true },
      orderBy: { _count: { countryId: 'desc' } },
      take: 8,
    }),
    db.volunteerProfile.groupBy({
      by: ['ageRange'],
      where: { user: { applications: { some: { status: { not: 'DRAFT' } } } } },
      _count: { _all: true },
    }),
    db.department.findMany({ select: { id: true, name: true } }),
  ])

  const countries = await db.country.findMany({
    where: { id: { in: byCountry.map((c) => c.countryId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, name: true },
  })

  // ----------------------------------------------------------------- trend
  /*
   * Submissions per week, last eight weeks. Raw SQL because Prisma cannot
   * group by a truncated date; the shape is tiny and read-only.
   */
  const trend = await db.$queryRaw<{ week: Date; count: bigint }[]>`
    SELECT date_trunc('week', "submittedAt") AS week, count(*) AS count
    FROM volunteer_applications
    WHERE "submittedAt" IS NOT NULL AND "submittedAt" > now() - interval '8 weeks'
    GROUP BY 1 ORDER BY 1
  `

  // --------------------------------------------------------- recent activity
  const showActivity = can(user, 'audit:view')
  const recentActivity = showActivity
    ? await db.auditLog.findMany({
        /*
         * Routine sign-ins are excluded here — an administrator's own logins
         * would otherwise be most of the feed, and "what happened recently?"
         * would answer "you did". The Activity Log itself keeps every event.
         */
        where: { action: { notIn: ['auth.login', 'auth.logout'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          action: true,
          createdAt: true,
          actor: { select: { username: true } },
        },
      })
    : []

  return {
    event: {
      registrationOpen: settings.registration_open,
    },
    applications: {
      total: applicationsByStatus.reduce((sum, row) => sum + row._count._all, 0),
      draft: appCount('DRAFT'),
      submitted: appCount('SUBMITTED'),
      underReview: appCount('UNDER_REVIEW'),
      approved: appCount('APPROVED'),
      waitlisted: appCount('WAITLISTED'),
      rejected: appCount('REJECTED'),
      awaitingReview,
      submittedThisWeek,
    },
    participations: {
      confirmed: participationsByStatus.reduce((sum, row) => sum + row._count._all, 0),
      signedUp: partCount('SIGNED_UP'),
      assigned: partCount('ASSIGNED'),
      checkedIn: partCount('CHECKED_IN'),
      completed: partCount('COMPLETED'),
      withdrawn: partCount('WITHDRAWN'),
      unconfirmed,
    },
    migration,
    comms,
    needsAttention,
    /*
     * Each row carries the id it was grouped by, not just a name, so the
     * overview can link into the filtered applicant list. A bar that reports
     * "Ushering 120" and cannot tell you *which* 120 is a dead end — the
     * number is only useful if you can act on the people behind it.
     *
     * The counts match what the link lands on: both sides exclude DRAFT, and
     * both reach department through this edition's participation.
     */
    distributions: {
      byDepartment: byDepartment
        .map((row) => ({
          id: row.departmentId,
          name: departments.find((d) => d.id === row.departmentId)?.name ?? 'No department yet',
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      byCountry: byCountry.map((row) => ({
        id: row.countryId,
        name: countries.find((c) => c.id === row.countryId)?.name ?? 'Unknown',
        count: row._count._all,
      })),
      byAgeRange: byAgeRange
        .map((row) => ({ ageRange: row.ageRange, count: row._count._all }))
        .sort((a, b) => (a.ageRange ?? '').localeCompare(b.ageRange ?? '')),
    },
    trend: trend.map((row) => ({ week: row.week, count: Number(row.count) })),
    recentActivity,
  }
}

/**
 * Human wording for audit actions shown on the overview.
 *
 * A short list on purpose — the full vocabulary belongs to the Activity Log
 * (Phase 14). Anything unlisted falls back to the raw code, which is still
 * more honest than hiding the event.
 */
export const ACTIVITY_LABELS: Record<string, string> = {
  'auth.register': 'New volunteer account created',
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in attempt',
  'application.submitted': 'Application submitted',
  'application.status_changed': 'Application status changed',
  'application.updated': 'Application updated',
  'application.exported': 'Applications exported',
  'health.viewed': 'Health information viewed',
  'announcement.created': 'Announcement created',
  'settings.updated': 'Settings changed',
  'user.role_changed': 'Administrator role changed',
  'migration.batch_created': 'Import uploaded',
  'migration.batch_validated': 'Import validated',
  'migration.import_queued': 'Import started',
  'migration.invitations_queued': 'Invitations queued',
  'migration.invitations_sent': 'Invitations sent',
  'migration.exported': 'Migration report downloaded',
}
