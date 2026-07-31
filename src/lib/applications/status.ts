import type { ApplicationStatus } from '@/generated/prisma/enums'

/**
 * Status vocabulary shared by server and client code.
 *
 * Deliberately free of `server-only` imports: the admin filter bar and review
 * panel are Client Components and need these labels, and importing them from
 * the service module would pull the database client into the browser bundle.
 */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  WAITLISTED: 'Waitlisted',
  REJECTED: 'Not accepted',
  ASSIGNED: 'Assigned',
  CHECKED_IN: 'Checked in',
  COMPLETED: 'Completed',
}

export const STATUS_TONES: Record<
  ApplicationStatus,
  'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  WAITLISTED: 'warning',
  REJECTED: 'danger',
  ASSIGNED: 'success',
  CHECKED_IN: 'success',
  COMPLETED: 'neutral',
}

/**
 * A volunteer may edit their own application until a decision has been made.
 * After that an administrator must reopen it.
 */
export function canVolunteerEdit(status: ApplicationStatus): boolean {
  return status === 'DRAFT' || status === 'SUBMITTED' || status === 'UNDER_REVIEW'
}
