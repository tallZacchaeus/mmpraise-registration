import 'server-only'
import { redirect } from 'next/navigation'
import type { Role } from '@/generated/prisma/enums'
import { getSessionUser, type SessionUser } from './session'

export { ADMIN_ROLES, ROLE_LABELS } from './roles'

/**
 * Role-based access control.
 *
 * Permissions are declared per role in one table so an auditor can read the
 * whole policy in a single place, and so a new role never silently inherits
 * capabilities it was not granted.
 */
export const PERMISSIONS = [
  'application:view_own',
  'application:edit_own',
  'application:view_all',
  'application:view_department',
  'application:review',
  'application:decide', // approve / reject / waitlist
  'application:assign_shift',
  'application:note',
  'application:export',
  'health:view', // restricted health information
  'volunteer:message',
  'announcement:manage',
  'department:manage',
  'question:manage',
  'reference:manage', // countries, regions, provinces, parishes
  'settings:manage',
  'user:manage',
  'audit:view',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  VOLUNTEER: ['application:view_own', 'application:edit_own'],

  SUPER_ADMIN: PERMISSIONS,

  REGISTRATION_ADMIN: [
    'application:view_own',
    'application:edit_own',
    'application:view_all',
    'application:review',
    'application:decide',
    'application:assign_shift',
    'application:note',
    'application:export',
    'volunteer:message',
    'announcement:manage',
    'department:manage',
    'question:manage',
    'reference:manage',
    'settings:manage',
    'audit:view',
  ],

  // Sees only applications for departments they are scoped to.
  DEPARTMENT_HEAD: [
    'application:view_own',
    'application:edit_own',
    'application:view_department',
    'application:review',
    'application:assign_shift',
    'application:note',
    'application:export',
    'announcement:manage',
  ],

  REVIEWER: ['application:view_own', 'application:edit_own', 'application:view_all', 'application:review', 'application:note'],

  // The only role that may read health information.
  MEDICAL_INFO_OFFICER: ['application:view_own', 'application:edit_own', 'application:view_all', 'health:view', 'application:note'],

  COMMUNICATION_OFFICER: [
    'application:view_own',
    'application:edit_own',
    'application:view_all',
    'volunteer:message',
    'announcement:manage',
    'application:export',
  ],
}

export function permissionsFor(roles: Role[]): Set<Permission> {
  const set = new Set<Permission>()
  for (const role of roles) for (const permission of ROLE_PERMISSIONS[role] ?? []) set.add(permission)
  return set
}

export function can(user: Pick<SessionUser, 'roles'> | null, permission: Permission): boolean {
  if (!user) return false
  return permissionsFor(user.roles).has(permission)
}

export function isAdmin(user: Pick<SessionUser, 'roles'> | null): boolean {
  if (!user) return false
  return user.roles.some((role) => role !== 'VOLUNTEER')
}

/**
 * Departments this user may act on.
 * `null` means "all departments" (no scoping restriction).
 */
export function departmentScope(user: SessionUser): string[] | null {
  if (can(user, 'application:view_all')) return null
  if (can(user, 'application:view_department')) return user.departmentScopes
  return []
}

// --- Guards ---------------------------------------------------------------

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}

export async function requireVerifiedUser(): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.emailVerified) redirect('/verify-email')
  return user
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user, permission)) redirect('/dashboard?denied=1')
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!isAdmin(user)) redirect('/dashboard?denied=1')
  return user
}
