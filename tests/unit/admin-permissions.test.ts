import { describe, expect, it } from 'vitest'
import {
  adminAccessSuspended,
  can,
  effectivePermissions,
  isAdmin,
  isSuspendedAdmin,
  permissionsFor,
} from '@/lib/auth/rbac'
import { sessionUser } from '../helpers/session'

/**
 * The permission policy.
 *
 * Every assertion here is about something that would be a security incident if
 * it stopped holding: a suspended administrator keeping their access, a revoke
 * that does not revoke, a renamed permission key silently granting an adjacent
 * capability.
 */

describe('effectivePermissions', () => {
  it('starts from the role defaults', () => {
    expect(effectivePermissions(['REVIEWER'])).toEqual(permissionsFor(['REVIEWER']))
  })

  it('adds a permission a role does not include', () => {
    const base = permissionsFor(['REVIEWER'])
    expect(base.has('application:export')).toBe(false)

    const granted = effectivePermissions(['REVIEWER'], [
      { permission: 'application:export', granted: true },
    ])
    expect(granted.has('application:export')).toBe(true)
    // Nothing else moved.
    expect(granted.has('health:view')).toBe(false)
  })

  it('revokes a permission the role does grant', () => {
    expect(permissionsFor(['DEPARTMENT_HEAD']).has('application:export')).toBe(true)

    const narrowed = effectivePermissions(['DEPARTMENT_HEAD'], [
      { permission: 'application:export', granted: false },
    ])
    expect(narrowed.has('application:export')).toBe(false)
    expect(narrowed.has('application:review')).toBe(true)
  })

  it('ignores a permission key it does not recognise', () => {
    /*
     * A renamed or deleted permission must never grant something adjacent.
     * Silently dropping the row is the safe reading: the administrator keeps
     * exactly their role defaults until somebody grants the new key.
     */
    const before = effectivePermissions(['REVIEWER'])
    const after = effectivePermissions(['REVIEWER'], [
      { permission: 'application:export_everything', granted: true },
    ])
    expect(after).toEqual(before)
  })

  it('can revoke from a super administrator', () => {
    const all = permissionsFor(['SUPER_ADMIN'])
    expect(all.has('health:view')).toBe(true)

    const narrowed = effectivePermissions(['SUPER_ADMIN'], [
      { permission: 'health:view', granted: false },
    ])
    expect(narrowed.has('health:view')).toBe(false)
  })
})

describe('adminAccessSuspended', () => {
  const now = new Date('2026-08-04T12:00:00Z')

  it('is false for an ordinary administrator', () => {
    expect(adminAccessSuspended(sessionUser({ roles: ['REVIEWER'] }), now)).toBe(false)
  })

  it('is true while disabled indefinitely', () => {
    const user = sessionUser({ roles: ['REVIEWER'], adminDisabledAt: new Date('2026-01-01') })
    expect(adminAccessSuspended(user, now)).toBe(true)
  })

  it('lapses on its own once the suspension date passes', () => {
    const suspended = sessionUser({
      roles: ['REVIEWER'],
      adminSuspendedUntil: new Date('2026-08-05T00:00:00Z'),
    })
    expect(adminAccessSuspended(suspended, now)).toBe(true)

    // The same record, read a day later. Nobody had to remember to switch it
    // back on, which is the whole point of a temporary suspension.
    expect(adminAccessSuspended(suspended, new Date('2026-08-06T00:00:00Z'))).toBe(false)
  })
})

describe('can', () => {
  it('honours role defaults', () => {
    expect(can(sessionUser({ roles: ['REVIEWER'] }), 'application:review')).toBe(true)
    expect(can(sessionUser({ roles: ['REVIEWER'] }), 'settings:manage')).toBe(false)
  })

  it('honours per-administrator overrides', () => {
    const user = sessionUser({
      roles: ['REVIEWER'],
      permissionOverrides: [{ permission: 'migration:view', granted: true }],
    })
    expect(can(user, 'migration:view')).toBe(true)
  })

  it('drops a suspended administrator to volunteer access, whatever they were granted', () => {
    const suspended = sessionUser({
      roles: ['SUPER_ADMIN'],
      permissionOverrides: [{ permission: 'migration:execute', granted: true }],
      adminDisabledAt: new Date('2026-01-01'),
    })

    expect(can(suspended, 'migration:execute')).toBe(false)
    expect(can(suspended, 'application:view_all')).toBe(false)
    expect(can(suspended, 'health:view')).toBe(false)
    // Their own volunteering is untouched — a suspension is not a ban.
    expect(can(suspended, 'application:view_own')).toBe(true)
    expect(can(suspended, 'application:edit_own')).toBe(true)
  })

  it('refuses everything for a signed-out visitor', () => {
    expect(can(null, 'application:view_own')).toBe(false)
  })
})

describe('isAdmin', () => {
  it('excludes a suspended administrator from the admin area entirely', () => {
    expect(isAdmin(sessionUser({ roles: ['REGISTRATION_ADMIN'] }))).toBe(true)
    expect(
      isAdmin(sessionUser({ roles: ['REGISTRATION_ADMIN'], adminDisabledAt: new Date('2026-01-01') })),
    ).toBe(false)
  })

  it('distinguishes "never an administrator" from "suspended"', () => {
    const volunteer = sessionUser({ roles: ['VOLUNTEER'] })
    const suspended = sessionUser({
      roles: ['REGISTRATION_ADMIN'],
      adminSuspendedUntil: new Date('2099-01-01'),
    })

    expect(isSuspendedAdmin(volunteer)).toBe(false)
    expect(isSuspendedAdmin(suspended)).toBe(true)
  })
})

describe('migration permissions', () => {
  it('are never granted by default to anyone but the super administrator', () => {
    /*
     * An import reads thousands of people's personal details and can email all
     * of them. Running one is granted explicitly to the individuals who do that
     * work — never inherited because somebody happens to be an administrator.
     */
    for (const role of ['REGISTRATION_ADMIN', 'DEPARTMENT_HEAD', 'REVIEWER', 'COMMUNICATION_OFFICER', 'MEDICAL_INFO_OFFICER'] as const) {
      const user = sessionUser({ roles: [role] })
      expect(can(user, 'migration:execute'), role).toBe(false)
      expect(can(user, 'migration:invite'), role).toBe(false)
      expect(can(user, 'migration:create'), role).toBe(false)
    }

    // The registration administrator may look, which is what makes the module
    // discoverable without making it runnable.
    expect(can(sessionUser({ roles: ['REGISTRATION_ADMIN'] }), 'migration:view')).toBe(true)
    expect(can(sessionUser({ roles: ['SUPER_ADMIN'] }), 'migration:execute')).toBe(true)
  })

  it('keeps health information to the one role that is meant to see it', () => {
    for (const role of ['REGISTRATION_ADMIN', 'DEPARTMENT_HEAD', 'REVIEWER', 'COMMUNICATION_OFFICER'] as const) {
      expect(can(sessionUser({ roles: [role] }), 'health:view'), role).toBe(false)
    }
    expect(can(sessionUser({ roles: ['MEDICAL_INFO_OFFICER'] }), 'health:view')).toBe(true)
  })
})
