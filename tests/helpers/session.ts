import type { SessionUser } from '@/lib/auth/session'

/**
 * Build a `SessionUser` for a test.
 *
 * A factory rather than an object literal per test file: `SessionUser` gains a
 * field whenever the platform learns something new about who is signed in —
 * department scopes, then permission overrides, then suspension — and each time
 * every literal in the suite stops compiling for reasons that have nothing to
 * do with what those tests are checking.
 *
 * Defaults describe an ordinary, unsuspended administrator with no overrides,
 * so a test only states the part it actually cares about.
 */
export function sessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'u1',
    email: 'a@b.co',
    username: 'a',
    roles: [],
    emailVerified: true,
    departmentScopes: [],
    firstName: null,
    lastName: null,
    photoDocumentId: null,
    permissionOverrides: [],
    adminDisabledAt: null,
    adminSuspendedUntil: null,
    ...overrides,
  }
}
