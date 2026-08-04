'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eventConfig } from '@/config/site'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { audit } from '@/lib/audit'
import { can, departmentScope, requirePermission } from '@/lib/auth/rbac'
import { fail, ok, parseOrFail, type ActionResult } from '@/lib/actions/result'
import { sendMailSafely } from '@/lib/mail/mailer'
import { announcementEmail, statusChangeEmail } from '@/lib/mail/templates'
import { setSetting } from '@/lib/settings'
import { transitionStatus } from '@/lib/applications/service'
import { STATUS_LABELS } from '@/lib/applications/status'
import { multilineText, trimmedText } from '@/lib/validation/common'
import type { ApplicationStatus } from '@/generated/prisma/enums'

/**
 * Administrative Server Actions.
 *
 * Each one re-checks its permission and, where the actor is department-scoped,
 * that the target application belongs to a department they administer.
 */

/**
 * Confirm the actor may act on this application; returns it or null.
 *
 * Scoping reads the current edition's participation, because department is a
 * per-edition choice. The participation rides along in the result so shift
 * actions do not have to fetch it again.
 */
async function loadScopedApplication(userScope: string[] | null, applicationId: string) {
  const application = await db.volunteerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      registrationId: true,
      participations: {
        where: { edition: eventConfig.edition },
        select: { id: true, departmentId: true, status: true },
      },
    },
  })
  if (!application || application.status === 'DRAFT') return null

  const participation = application.participations[0] ?? null
  if (
    userScope !== null &&
    (!participation?.departmentId || !userScope.includes(participation.departmentId))
  ) {
    return null
  }
  return { ...application, participation }
}

// --- Status transitions ---------------------------------------------------

const statusSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'WAITLISTED',
    'REJECTED',
    'ASSIGNED',
    'CHECKED_IN',
    'COMPLETED',
  ]),
  reason: z.string().max(1000).optional(),
  notify: z.boolean().default(true),
})

export async function changeStatusAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('application:review')
  const parsed = parseOrFail(statusSchema, input)
  if (!parsed.ok) return parsed.result
  const { applicationId, status, reason, notify } = parsed.data

  // Deciding an outcome is a higher bar than moving something into review.
  const isDecision = ['APPROVED', 'REJECTED', 'WAITLISTED'].includes(status)
  if (isDecision && !can(user, 'application:decide')) {
    return fail('You do not have permission to approve, reject or waitlist applications')
  }

  const application = await loadScopedApplication(departmentScope(user), applicationId)
  if (!application) return fail('Application not found, or outside the departments you administer')

  if (status === 'REJECTED' && !reason?.trim()) {
    return fail('Give a reason when rejecting an application', {
      reason: 'A reason is required so the volunteer receives an explanation',
    })
  }

  await transitionStatus({
    applicationId,
    to: status as ApplicationStatus,
    actorId: user.id,
    reason: reason?.trim() || null,
  })

  await audit({
    action: 'application.status_changed',
    entityType: 'VolunteerApplication',
    entityId: applicationId,
    actorId: user.id,
    metadata: { from: application.status, to: status },
  })

  if (notify) {
    const record = await db.volunteerApplication.findUnique({
      where: { id: applicationId },
      select: {
        registrationId: true,
        participations: {
          where: { edition: eventConfig.edition },
          select: { department: { select: { name: true } } },
        },
        user: { select: { email: true, mmpCode: true, profile: { select: { firstName: true } } } },
      },
    })

    if (record?.user.email) {
      // Health information is never referenced in status emails.
      const message = statusChangeEmail({
        name: record.user.profile?.firstName ?? 'there',
        // The number the volunteer knows, not the internal reference.
        registrationId: record.user.mmpCode ?? record.registrationId,
        status: STATUS_LABELS[status as ApplicationStatus],
        department: record.participations[0]?.department?.name ?? 'Unassigned',
        message: reason?.trim() || null,
        loginUrl: `${env.APP_URL}/dashboard`,
      })
      await sendMailSafely({ ...message, to: record.user.email })
    }
  }

  revalidatePath(`/admin/applications/${applicationId}`)
  revalidatePath('/admin/applications')
  return ok()
}

// --- Internal notes -------------------------------------------------------

const noteSchema = z.object({
  applicationId: z.string().min(1),
  body: multilineText(2000).pipe(z.string().min(2, 'Write a note before saving')),
})

export async function addNoteAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('application:note')
  const parsed = parseOrFail(noteSchema, input)
  if (!parsed.ok) return parsed.result

  const application = await loadScopedApplication(departmentScope(user), parsed.data.applicationId)
  if (!application) return fail('Application not found, or outside the departments you administer')

  await db.adminNote.create({
    data: { applicationId: parsed.data.applicationId, authorId: user.id, body: parsed.data.body },
  })

  await audit({
    action: 'application.note_added',
    entityType: 'VolunteerApplication',
    entityId: parsed.data.applicationId,
    actorId: user.id,
  })

  revalidatePath(`/admin/applications/${parsed.data.applicationId}`)
  return ok()
}

// --- Restricted health information ---------------------------------------

/**
 * Reveal a volunteer's declared health information.
 * Gated on the health:view permission and recorded in the audit log every time,
 * so access to this data is always attributable.
 */
export async function revealHealthInfoAction(
  applicationId: string,
): Promise<ActionResult<{ hasCondition: boolean; details: string | null }>> {
  const user = await requirePermission('health:view')

  const application = await loadScopedApplication(departmentScope(user), applicationId)
  if (!application) return fail('Application not found')

  const health = await db.applicationHealthInfo.findUnique({ where: { applicationId } })

  await audit({
    action: 'health.viewed',
    entityType: 'VolunteerApplication',
    entityId: applicationId,
    actorId: user.id,
    metadata: { registrationId: application.registrationId },
  })

  return ok({ hasCondition: health?.hasCondition ?? false, details: health?.details ?? null })
}

// --- Shift assignment -----------------------------------------------------

const assignSchema = z.object({
  applicationId: z.string().min(1),
  shiftId: z.string().min(1),
})

export async function assignShiftAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('application:assign_shift')
  const parsed = parseOrFail(assignSchema, input)
  if (!parsed.ok) return parsed.result

  const application = await loadScopedApplication(departmentScope(user), parsed.data.applicationId)
  if (!application) return fail('Application not found, or outside the departments you administer')

  const shift = await db.shift.findUnique({
    where: { id: parsed.data.shiftId },
    include: { _count: { select: { assignments: true } } },
  })
  if (!shift) return fail('Shift not found')
  if (shift.capacity && shift._count.assignments >= shift.capacity) {
    return fail(`${shift.name} is already full`)
  }

  // A shift belongs to an edition, so the assignment hangs off the
  // participation — there must be one before a shift can be given.
  if (!application.participation) {
    return fail('This volunteer has not signed up for the current edition yet')
  }

  const existing = await db.shiftAssignment.findUnique({
    where: {
      shiftId_participationId: { shiftId: shift.id, participationId: application.participation.id },
    },
  })
  if (existing) return fail('This volunteer is already assigned to that shift')

  await db.shiftAssignment.create({
    data: {
      shiftId: shift.id,
      participationId: application.participation.id,
      assignedById: user.id,
    },
  })

  // Being given a shift moves this edition's participation forward. Approval
  // itself is untouched — it was granted once and stays granted.
  if (application.participation.status === 'SIGNED_UP') {
    await db.editionParticipation.update({
      where: { id: application.participation.id },
      data: { status: 'ASSIGNED' },
    })
  }

  await audit({
    action: 'application.shift_assigned',
    entityType: 'VolunteerApplication',
    entityId: application.id,
    actorId: user.id,
    metadata: { shiftId: shift.id, shiftName: shift.name },
  })

  revalidatePath(`/admin/applications/${application.id}`)
  return ok()
}

export async function removeShiftAssignmentAction(assignmentId: string): Promise<ActionResult> {
  const user = await requirePermission('application:assign_shift')
  const assignment = await db.shiftAssignment.findUnique({
    where: { id: assignmentId },
    select: { participation: { select: { applicationId: true } } },
  })
  if (!assignment) return fail('Assignment not found')

  const application = await loadScopedApplication(
    departmentScope(user),
    assignment.participation.applicationId,
  )
  if (!application) return fail('Application not found')

  await db.shiftAssignment.delete({ where: { id: assignmentId } })
  revalidatePath(`/admin/applications/${application.id}`)
  return ok()
}

// --- Announcements --------------------------------------------------------

const announcementSchema = z.object({
  title: trimmedText(120).pipe(z.string().min(3, 'Give the announcement a title')),
  body: multilineText(4000).pipe(z.string().min(10, 'Write the announcement')),
  audience: z.enum(['ALL_VOLUNTEERS', 'DEPARTMENT', 'APPROVED_ONLY']),
  departmentId: z.string().optional().nullable(),
  publish: z.boolean().default(false),
  sendEmail: z.boolean().default(false),
})

export async function createAnnouncementAction(input: unknown): Promise<ActionResult<{ recipients: number }>> {
  const user = await requirePermission('announcement:manage')
  const parsed = parseOrFail(announcementSchema, input)
  if (!parsed.ok) return parsed.result
  const data = parsed.data

  if (data.audience === 'DEPARTMENT' && !data.departmentId) {
    return fail('Choose a department', { departmentId: 'Choose which department this is for' })
  }

  // A department head may only address their own departments.
  const scope = departmentScope(user)
  if (scope !== null) {
    if (data.audience !== 'DEPARTMENT' || !data.departmentId || !scope.includes(data.departmentId)) {
      return fail('You can only send announcements to departments you administer')
    }
  }

  const announcement = await db.announcement.create({
    data: {
      title: data.title,
      body: data.body,
      audience: data.audience,
      departmentId: data.audience === 'DEPARTMENT' ? data.departmentId : null,
      publishedAt: data.publish ? new Date() : null,
      createdById: user.id,
    },
  })

  await audit({
    action: 'announcement.created',
    entityType: 'Announcement',
    entityId: announcement.id,
    actorId: user.id,
    metadata: { audience: data.audience, published: data.publish },
  })

  let recipients = 0
  if (data.publish && data.sendEmail) {
    if (!can(user, 'volunteer:message')) {
      return fail('You do not have permission to email volunteers')
    }

    const targets = await db.volunteerApplication.findMany({
      where: {
        status:
          data.audience === 'APPROVED_ONLY'
            ? { in: ['APPROVED', 'ASSIGNED', 'CHECKED_IN'] }
            : { not: 'DRAFT' },
        ...(data.audience === 'DEPARTMENT' ? { departmentId: data.departmentId! } : {}),
      },
      select: { user: { select: { email: true, profile: { select: { firstName: true } } } } },
    })

    for (const target of targets) {
      const message = announcementEmail({
        name: target.user.profile?.firstName ?? 'there',
        title: data.title,
        body: data.body,
        loginUrl: `${env.APP_URL}/dashboard`,
      })
      await sendMailSafely({ ...message, to: target.user.email })
      recipients++
    }
  }

  revalidatePath('/admin/announcements')
  revalidatePath('/dashboard')
  return ok({ recipients })
}

export async function toggleAnnouncementAction(id: string, publish: boolean): Promise<ActionResult> {
  const user = await requirePermission('announcement:manage')
  await db.announcement.update({
    where: { id },
    data: { publishedAt: publish ? new Date() : null },
  })
  await audit({ action: 'announcement.updated', entityType: 'Announcement', entityId: id, actorId: user.id })
  revalidatePath('/admin/announcements')
  revalidatePath('/dashboard')
  return ok()
}

// --- Settings -------------------------------------------------------------

const settingsSchema = z.object({
  registration_open: z.boolean(),
  registration_closed_message: trimmedText(500),
  event_name: trimmedText(120),
  event_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')),
  support_email: z.string().email(),
})

export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('settings:manage')
  const parsed = parseOrFail(settingsSchema, input)
  if (!parsed.ok) return parsed.result

  for (const [key, value] of Object.entries(parsed.data)) {
    await setSetting(key as keyof typeof parsed.data, value as never)
  }

  await audit({
    action: 'settings.updated',
    entityType: 'Setting',
    actorId: user.id,
    metadata: { keys: Object.keys(parsed.data) },
  })

  revalidatePath('/admin/settings')
  revalidatePath('/', 'layout')
  return ok()
}

const departmentStateSchema = z.object({
  departmentId: z.string().min(1),
  isActive: z.boolean(),
})

export async function updateDepartmentAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('department:manage')
  const parsed = parseOrFail(departmentStateSchema, input)
  if (!parsed.ok) return parsed.result

  await db.department.update({
    where: { id: parsed.data.departmentId },
    data: { isActive: parsed.data.isActive },
  })

  await audit({
    action: 'department.updated',
    entityType: 'Department',
    entityId: parsed.data.departmentId,
    actorId: user.id,
    metadata: { isActive: parsed.data.isActive },
  })

  revalidatePath('/admin/departments')
  return ok()
}

// --- Testimony moderation -------------------------------------------------

const moderationSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  note: z.string().max(500).optional(),
})

/**
 * Approve or decline a testimony submitted from the homepage.
 * Public submissions are never rendered on the site until this has run with
 * APPROVED, so the queue is the only path to publication.
 */
export async function moderateTestimonyAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('testimony:moderate')
  const parsed = parseOrFail(moderationSchema, input)
  if (!parsed.ok) return parsed.result

  const submission = await db.testimonySubmission.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, status: true },
  })
  if (!submission) return fail('Testimony not found')

  const note = parsed.data.note?.trim()

  await db.$transaction([
    db.testimonySubmission.update({
      where: { id: submission.id },
      data: {
        status: parsed.data.status,
        reviewNote: note || null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    }),
    /*
     * The note joins the timeline rather than only overwriting `reviewNote`.
     * A submission that was declined, discussed and reopened has a history,
     * and "who said what, when" is what the next moderator needs.
     */
    ...(note
      ? [
          db.testimonyNote.create({
            data: { testimonyId: submission.id, authorId: user.id, body: note },
          }),
        ]
      : []),
  ])

  await audit({
    action: 'testimony.moderated',
    entityType: 'TestimonySubmission',
    entityId: submission.id,
    actorId: user.id,
    metadata: { from: submission.status, to: parsed.data.status },
  })

  revalidatePath('/admin/testimonies')
  revalidatePath('/')
  return ok()
}

// --- Testimony workload -----------------------------------------------------

/** Take or hand over a testimony. Advisory, never a lock. */
export async function assignTestimonyAction(id: string, toSelf: boolean): Promise<ActionResult> {
  const user = await requirePermission('testimony:moderate')

  const submission = await db.testimonySubmission.findUnique({ where: { id }, select: { id: true } })
  if (!submission) return fail('Testimony not found')

  await db.testimonySubmission.update({
    where: { id },
    data: { assignedToId: toSelf ? user.id : null },
  })

  revalidatePath('/admin/testimonies')
  return ok()
}

const testimonyFlagsSchema = z.object({
  id: z.string().min(1),
  isSpam: z.boolean().optional(),
  isTestData: z.boolean().optional(),
  featured: z.boolean().optional(),
})

/** Tag spam or test data, or feature an approved testimony. */
export async function setTestimonyFlagsAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('testimony:moderate')
  const parsed = parseOrFail(testimonyFlagsSchema, input)
  if (!parsed.ok) return parsed.result

  const submission = await db.testimonySubmission.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, status: true },
  })
  if (!submission) return fail('Testimony not found')

  if (parsed.data.featured && submission.status !== 'APPROVED') {
    // Featuring publishes; only approval decides what may be published.
    return fail('Only an approved testimony can be featured')
  }

  await db.testimonySubmission.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.isSpam !== undefined ? { isSpam: parsed.data.isSpam } : {}),
      ...(parsed.data.isTestData !== undefined ? { isTestData: parsed.data.isTestData } : {}),
      ...(parsed.data.featured !== undefined
        ? { featuredAt: parsed.data.featured ? new Date() : null }
        : {}),
    },
  })

  await audit({
    action: 'testimony.moderated',
    entityType: 'TestimonySubmission',
    entityId: parsed.data.id,
    actorId: user.id,
    metadata: { flags: parsed.data },
  })

  revalidatePath('/admin/testimonies')
  return ok()
}

/** Add to the moderation timeline without changing the status. */
export async function addTestimonyNoteAction(id: string, body: string): Promise<ActionResult> {
  const user = await requirePermission('testimony:moderate')

  const text = body.trim()
  if (!text) return fail('Write the note first')
  if (text.length > 1000) return fail('Notes are limited to 1,000 characters')

  const submission = await db.testimonySubmission.findUnique({ where: { id }, select: { id: true } })
  if (!submission) return fail('Testimony not found')

  await db.testimonyNote.create({ data: { testimonyId: id, authorId: user.id, body: text } })

  revalidatePath('/admin/testimonies')
  return ok()
}

/**
 * Reject every tagged test submission in one pass.
 *
 * Counted like bulk approval: the dialog showed a number, the server re-counts
 * and refuses if it changed. Only rows already *tagged* as test data are
 * touched — tagging is the human judgement, this is just the broom.
 */
export async function bulkRejectTestDataAction(
  expectedCount: number,
): Promise<ActionResult<{ rejected: number }>> {
  const user = await requirePermission('testimony:moderate')

  const where = { isTestData: true, status: 'PENDING' as const }
  const matching = await db.testimonySubmission.count({ where })
  if (matching === 0) return fail('No pending submissions are tagged as test data.')
  if (matching !== expectedCount) {
    return fail(
      `${matching} pending submissions are tagged as test data now, not the ${expectedCount} you confirmed. Nothing was changed.`,
    )
  }

  await db.testimonySubmission.updateMany({
    where,
    data: { status: 'REJECTED', reviewedById: user.id, reviewedAt: new Date() },
  })

  await audit({
    action: 'testimony.moderated',
    entityType: 'TestimonySubmission',
    actorId: user.id,
    metadata: { event: 'bulk_reject_test_data', count: matching },
  })

  revalidatePath('/admin/testimonies')
  return ok({ rejected: matching })
}

const contactTriageSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED']),
  note: z.string().max(500).optional(),
})

/** Move a contact message through triage and record who dealt with it. */
export async function triageContactMessageAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('contact:manage')
  const parsed = parseOrFail(contactTriageSchema, input)
  if (!parsed.ok) return parsed.result

  const message = await db.contactMessage.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, status: true },
  })
  if (!message) return fail('Message not found')

  const note = parsed.data.note?.trim()

  await db.$transaction([
    db.contactMessage.update({
      where: { id: message.id },
      data: {
        status: parsed.data.status,
        handlerNote: note || null,
        handledById: user.id,
        handledAt: new Date(),
      },
    }),
    // Notes accumulate in the timeline; the legacy field just mirrors the last.
    ...(note
      ? [db.contactNote.create({ data: { messageId: message.id, authorId: user.id, body: note } })]
      : []),
  ])

  await audit({
    action: 'contact.triaged',
    entityType: 'ContactMessage',
    entityId: message.id,
    actorId: user.id,
    metadata: { from: message.status, to: parsed.data.status },
  })

  revalidatePath('/admin/messages')
  return ok()
}

// --- Bulk approval ----------------------------------------------------------

const bulkApproveSchema = z.object({
  /** The list filters at the moment the button was pressed. */
  filters: z.object({
    q: z.string().optional(),
    status: z.string().optional(),
    departmentId: z.string().optional(),
    countryId: z.string().optional(),
    churchRegionId: z.string().optional(),
    ageRange: z.string().optional(),
  }),
  /**
   * What the administrator saw when they confirmed. The action re-counts and
   * refuses if the queue changed underneath them — approving "the 133 I just
   * read" must never silently become approving 190.
   */
  expectedCount: z.number().int().min(1),
  reason: z.string().trim().max(500).optional(),
})

/** Per invocation. Keeps one request comfortably inside a timeout. */
const BULK_APPROVE_LIMIT = 500

/**
 * Approve every reviewable application matching the current filters.
 *
 * Exists because approval is a one-time judgement about a person: with 13,969
 * returning volunteers plus new registrants, one-at-a-time approval is not an
 * interface, it is a punishment. Three properties hold:
 *
 *  1. **Only SUBMITTED and UNDER_REVIEW rows are touched.** A filter that
 *     happens to include rejected or approved applications cannot flip them.
 *  2. **The count is a contract.** The dialog showed a number; if the matching
 *     set has changed since, the action refuses and the administrator looks
 *     again.
 *  3. **One status-history row and one audit record per volunteer.** A single
 *     "approved 4,902 volunteers" line is unauditable afterwards — each
 *     decision must be traceable on its own application.
 */
export async function bulkApproveAction(
  input: unknown,
): Promise<ActionResult<{ approved: number; remaining: number }>> {
  const user = await requirePermission('application:decide')

  const parsed = parseOrFail(bulkApproveSchema, input)
  if (!parsed.ok) return parsed.result
  const { filters, expectedCount, reason } = parsed.data

  const { buildWhere } = await import('@/lib/admin/queries')
  const where = {
    AND: [
      buildWhere(user, filters),
      // The narrowing that makes the operation safe whatever the filter says.
      { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] as ApplicationStatus[] } },
    ],
  }

  const matching = await db.volunteerApplication.count({ where })
  if (matching === 0) {
    return fail('Nothing in this view is awaiting review.')
  }
  if (matching !== expectedCount) {
    return fail(
      `This view now matches ${matching} reviewable application${matching === 1 ? '' : 's'}, not the ${expectedCount} you confirmed. Nothing was changed — check the list and try again.`,
      undefined,
      'count_changed',
    )
  }

  const batch = await db.volunteerApplication.findMany({
    where,
    select: { id: true },
    orderBy: { submittedAt: 'asc' },
    take: BULK_APPROVE_LIMIT,
  })

  let approved = 0
  for (const application of batch) {
    // transitionStatus writes the application update and its history row in one
    // transaction, so a crash mid-batch leaves whole decisions, never halves.
    await transitionStatus({
      applicationId: application.id,
      to: 'APPROVED',
      actorId: user.id,
      reason: reason?.trim() || null,
    })
    await audit({
      action: 'application.status_changed',
      entityType: 'VolunteerApplication',
      entityId: application.id,
      actorId: user.id,
      metadata: { to: 'APPROVED', bulk: true, batchSize: batch.length },
    })
    approved += 1
  }

  revalidatePath('/admin/applications')
  revalidatePath('/admin')

  return ok({ approved, remaining: matching - approved })
}

// --- Contact helpdesk -------------------------------------------------------

/** Take or hand over a message. Advisory, never a lock. */
export async function assignContactMessageAction(id: string, toSelf: boolean): Promise<ActionResult> {
  const user = await requirePermission('contact:manage')

  const message = await db.contactMessage.findUnique({ where: { id }, select: { id: true } })
  if (!message) return fail('Message not found')

  await db.contactMessage.update({
    where: { id },
    data: { assignedToId: toSelf ? user.id : null },
  })

  revalidatePath('/admin/messages')
  return ok()
}

const contactControlsSchema = z.object({
  id: z.string().min(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  isSpam: z.boolean().optional(),
  isTestData: z.boolean().optional(),
})

/** Priority and spam/test tagging for one message. */
export async function setContactControlsAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('contact:manage')
  const parsed = parseOrFail(contactControlsSchema, input)
  if (!parsed.ok) return parsed.result

  const message = await db.contactMessage.findUnique({
    where: { id: parsed.data.id },
    select: { id: true },
  })
  if (!message) return fail('Message not found')

  await db.contactMessage.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.isSpam !== undefined ? { isSpam: parsed.data.isSpam } : {}),
      ...(parsed.data.isTestData !== undefined ? { isTestData: parsed.data.isTestData } : {}),
    },
  })

  await audit({
    action: 'contact.triaged',
    entityType: 'ContactMessage',
    entityId: parsed.data.id,
    actorId: user.id,
    metadata: { controls: parsed.data },
  })

  revalidatePath('/admin/messages')
  return ok()
}

/** Add to a message's note timeline without changing its status. */
export async function addContactNoteAction(id: string, body: string): Promise<ActionResult> {
  const user = await requirePermission('contact:manage')

  const text = body.trim()
  if (!text) return fail('Write the note first')
  if (text.length > 1000) return fail('Notes are limited to 1,000 characters')

  const message = await db.contactMessage.findUnique({ where: { id }, select: { id: true } })
  if (!message) return fail('Message not found')

  await db.contactNote.create({ data: { messageId: id, authorId: user.id, body: text } })

  revalidatePath('/admin/messages')
  return ok()
}

/**
 * Resolve every tagged test message in one counted pass — the same contract as
 * every other bulk action here: the dialog showed a number, the server
 * re-counts, and a changed queue refuses rather than acting on it.
 */
export async function bulkResolveTestMessagesAction(
  expectedCount: number,
): Promise<ActionResult<{ resolved: number }>> {
  const user = await requirePermission('contact:manage')

  const where = { isTestData: true, status: { not: 'RESOLVED' as const } }
  const matching = await db.contactMessage.count({ where })
  if (matching === 0) return fail('No open messages are tagged as test data.')
  if (matching !== expectedCount) {
    return fail(
      `${matching} open messages are tagged as test data now, not the ${expectedCount} you confirmed. Nothing was changed.`,
    )
  }

  await db.contactMessage.updateMany({
    where,
    data: { status: 'RESOLVED', handledById: user.id, handledAt: new Date() },
  })

  await audit({
    action: 'contact.triaged',
    entityType: 'ContactMessage',
    actorId: user.id,
    metadata: { event: 'bulk_resolve_test_data', count: matching },
  })

  revalidatePath('/admin/messages')
  return ok({ resolved: matching })
}
