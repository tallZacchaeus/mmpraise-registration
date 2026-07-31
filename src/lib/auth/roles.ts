import type { Role } from '@/generated/prisma/enums'

/**
 * Role display names, safe to import from Client Components.
 *
 * Kept apart from rbac.ts because that module reads the session and therefore
 * imports `next/headers`, which cannot be pulled into a browser bundle.
 */
export const ROLE_LABELS: Record<Role, string> = {
  VOLUNTEER: 'Volunteer',
  SUPER_ADMIN: 'Super Administrator',
  REGISTRATION_ADMIN: 'Registration Administrator',
  DEPARTMENT_HEAD: 'Department Head',
  REVIEWER: 'Reviewer',
  MEDICAL_INFO_OFFICER: 'Medical Information Officer',
  COMMUNICATION_OFFICER: 'Communication Officer',
}

/** Every role that grants access to the administration area. */
export const ADMIN_ROLES: Role[] = [
  'SUPER_ADMIN',
  'REGISTRATION_ADMIN',
  'DEPARTMENT_HEAD',
  'REVIEWER',
  'MEDICAL_INFO_OFFICER',
  'COMMUNICATION_OFFICER',
]
