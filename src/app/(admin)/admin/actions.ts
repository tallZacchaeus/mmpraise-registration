'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
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

/** Confirm the actor may act on this application; returns it or an error. */
async function loadScopedApplication(userScope: string[] | null, applicationId: string) {
  const application = await db.volunteerApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, departmentId: true, registrationId: true },
  })
  if (!application || application.status === 'DRAFT') return null
  if (userScope !== null && (!application.departmentId || !userScope.includes(application.departmentId))) return null
  return application
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
        department: { select: { name: true } },
        user: { select: { email: true, profile: { select: { firstName: true } } } },
      },
    })

    if (record?.user.email) {
      // Health information is never referenced in status emails.
      const message = statusChangeEmail({
        name: record.user.profile?.firstName ?? 'there',
        registrationId: record.registrationId,
        status: STATUS_LABELS[status as ApplicationStatus],
        department: record.department?.name ?? 'Unassigned',
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

  const existing = await db.shiftAssignment.findUnique({
    where: { shiftId_applicationId: { shiftId: shift.id, applicationId: application.id } },
  })
  if (existing) return fail('This volunteer is already assigned to that shift')

  await db.shiftAssignment.create({
    data: { shiftId: shift.id, applicationId: application.id, assignedById: user.id },
  })

  // Assigning a shift implies the volunteer is on the team.
  if (application.status === 'APPROVED') {
    await transitionStatus({ applicationId: application.id, to: 'ASSIGNED', actorId: user.id })
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
    select: { applicationId: true },
  })
  if (!assignment) return fail('Assignment not found')

  const application = await loadScopedApplication(departmentScope(user), assignment.applicationId)
  if (!application) return fail('Application not found')

  await db.shiftAssignment.delete({ where: { id: assignmentId } })
  revalidatePath(`/admin/applications/${assignment.applicationId}`)
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

const capacitySchema = z.object({
  departmentId: z.string().min(1),
  capacity: z.number().int().min(0).nullable(),
  isActive: z.boolean(),
})

export async function updateDepartmentAction(input: unknown): Promise<ActionResult> {
  const user = await requirePermission('department:manage')
  const parsed = parseOrFail(capacitySchema, input)
  if (!parsed.ok) return parsed.result

  await db.department.update({
    where: { id: parsed.data.departmentId },
    data: { capacity: parsed.data.capacity, isActive: parsed.data.isActive },
  })

  await audit({
    action: 'department.updated',
    entityType: 'Department',
    entityId: parsed.data.departmentId,
    actorId: user.id,
    metadata: { capacity: parsed.data.capacity, isActive: parsed.data.isActive },
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
  const user = await requirePermission('application:review')
  const parsed = parseOrFail(moderationSchema, input)
  if (!parsed.ok) return parsed.result

  const submission = await db.testimonySubmission.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, status: true },
  })
  if (!submission) return fail('Testimony not found')

  await db.testimonySubmission.update({
    where: { id: submission.id },
    data: {
      status: parsed.data.status,
      reviewNote: parsed.data.note?.trim() || null,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  })

  await audit({
    action: 'application.note_added',
    entityType: 'TestimonySubmission',
    entityId: submission.id,
    actorId: user.id,
    metadata: { from: submission.status, to: parsed.data.status },
  })

  revalidatePath('/admin/testimonies')
  revalidatePath('/')
  return ok()
}
