import type { ApplicationStatus } from '@/generated/prisma/enums'

/**
 * The volunteer's notification feed.
 *
 * There is no notifications table, and adding one would mean writing a row on
 * every state change from every code path that can cause one — a second source
 * of truth that starts drifting from the first the moment anybody forgets.
 *
 * So the feed is *derived*. Every entry below is read from a timestamp the
 * platform already records: when the account was made, when the email was
 * confirmed, when a draft was last written, when the status moved, when shifts
 * were published. Nothing is stored twice, nothing can go stale, and a
 * volunteer sees exactly what happened.
 *
 * The cost is that these are events, not messages: they cannot be marked read
 * and they carry no per-volunteer state. That is the right trade for a feed
 * whose whole job is to explain the application's own history.
 *
 * Deliberately free of `server-only` imports so it can be unit tested.
 */

export type NotificationKind =
  | 'account'
  | 'email'
  | 'draft'
  | 'status'
  | 'department'
  | 'shifts'

export type NotificationItem = {
  id: string
  kind: NotificationKind
  title: string
  body: string | null
  at: Date
}

export type NotificationInput = {
  accountCreatedAt: Date
  emailVerifiedAt: Date | null
  application: {
    status: ApplicationStatus
    updatedAt: Date
    submittedAt: Date | null
    departmentName: string | null
  } | null
  statusHistory: {
    id: string
    toStatus: ApplicationStatus
    reason: string | null
    createdAt: Date
  }[]
  /** Assignment rows, used only for their creation times. */
  assignments: { id: string; createdAt: Date }[]
}

/** Wording for a status change, from the volunteer's side of it. */
function statusNotification(status: ApplicationStatus): { title: string; body: string | null } {
  switch (status) {
    case 'SUBMITTED':
      return {
        title: 'Application submitted',
        body: 'Your application is now with your department. You will hear from them by email.',
      }
    case 'UNDER_REVIEW':
      return {
        title: 'Your application is being reviewed',
        body: 'Somebody from your department is reading it now.',
      }
    case 'APPROVED':
      return { title: 'You have been approved', body: 'Welcome to the team.' }
    case 'WAITLISTED':
      return {
        title: 'You are on the waiting list',
        body: 'If a place opens in your department we will contact you.',
      }
    case 'REJECTED':
      return {
        title: 'Your application was not accepted',
        body: 'You are welcome to apply again for the next edition.',
      }
    case 'ASSIGNED':
      return { title: 'Your shifts are set', body: 'They are listed on your dashboard.' }
    case 'CHECKED_IN':
      return { title: 'You are checked in', body: null }
    case 'COMPLETED':
      return { title: 'Thank you for serving', body: 'Your volunteering is recorded as complete.' }
    case 'DRAFT':
      return { title: 'Your application was reopened', body: 'You can edit and resubmit it.' }
  }
}

export function buildNotifications(input: NotificationInput): NotificationItem[] {
  const items: NotificationItem[] = [
    {
      id: 'account-created',
      kind: 'account',
      title: 'Account created',
      body: 'Welcome to MMPraise Volunteers.',
      at: input.accountCreatedAt,
    },
  ]

  if (input.emailVerifiedAt) {
    items.push({
      id: 'email-verified',
      kind: 'email',
      title: 'Email address confirmed',
      body: 'We can now reach you about your application.',
      at: input.emailVerifiedAt,
    })
  }

  /*
   * "Draft saved" is only worth showing while there *is* a draft. Once an
   * application is submitted, `updatedAt` moves for reasons that have nothing
   * to do with the volunteer — a reviewer opening it, an administrator adding a
   * note — and reporting that as "your draft was saved" would be a lie.
   */
  if (input.application?.status === 'DRAFT') {
    items.push({
      id: 'draft-saved',
      kind: 'draft',
      title: 'Draft saved',
      body: 'Everything you have entered so far is stored. Nothing is submitted yet.',
      at: input.application.updatedAt,
    })
  }

  for (const entry of input.statusHistory) {
    const { title, body } = statusNotification(entry.toStatus)
    items.push({
      id: `status-${entry.id}`,
      kind: 'status',
      title,
      // A reviewer's own words always beat the generic sentence.
      body: entry.reason ?? body,
      at: entry.createdAt,
    })
  }

  /*
   * Department confirmation is not a status of its own, so it is reported at
   * the moment of approval — which is when it becomes true for the volunteer.
   */
  const approval = input.statusHistory.find((e) => e.toStatus === 'APPROVED')
  if (approval && input.application?.departmentName) {
    items.push({
      id: 'department-confirmed',
      kind: 'department',
      title: `Department confirmed: ${input.application.departmentName}`,
      body: 'This is the team you will be serving with.',
      at: approval.createdAt,
    })
  }

  /*
   * Shifts are published in batches. One entry per assignment would bury
   * everything else in the feed, so they are collapsed into a single event at
   * the time the last one landed.
   */
  if (input.assignments.length > 0) {
    const latest = input.assignments.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
    const count = input.assignments.length
    items.push({
      id: 'shifts-published',
      kind: 'shifts',
      title: `${count} ${count === 1 ? 'shift' : 'shifts'} published`,
      body: 'Check the times and location on your dashboard.',
      at: latest.createdAt,
    })
  }

  // Newest first, and stable: two events on the same millisecond keep the order
  // they were built in rather than swapping between renders.
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.at.getTime() - a.item.at.getTime() || a.index - b.index)
    .map(({ item }) => item)
}
