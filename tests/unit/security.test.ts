import { describe, expect, it } from 'vitest'
import { hashPassword, needsRehash, verifyPassword } from '@/lib/auth/password'
import { generateToken, hashToken, tokensMatch } from '@/lib/auth/tokens'
import { can, isAdmin, departmentScope, permissionsFor } from '@/lib/auth/rbac'
import { sniffMimeType } from '@/lib/files'
import type { SessionUser } from '@/lib/auth/session'
import { sessionUser } from '../helpers/session'

const user = (roles: SessionUser['roles'], departmentScopes: string[] = []): SessionUser =>
  sessionUser({ roles, departmentScopes })

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('Praise2026!')
    expect(await verifyPassword('Praise2026!', hash)).toBe(true)
    expect(await verifyPassword('praise2026!', hash)).toBe(false)
    expect(await verifyPassword('', hash)).toBe(false)
  })

  it('never stores the password in the hash', async () => {
    const hash = await hashPassword('Praise2026!')
    expect(hash).not.toContain('Praise2026!')
    expect(hash.startsWith('scrypt$')).toBe(true)
  })

  it('salts, so the same password hashes differently each time', async () => {
    expect(await hashPassword('Praise2026!')).not.toBe(await hashPassword('Praise2026!'))
  })

  it('rejects malformed stored hashes instead of throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('x', 'scrypt$$$$')).toBe(false)
    expect(await verifyPassword('x', '')).toBe(false)
  })

  it('flags hashes weaker than current policy for upgrade', async () => {
    expect(needsRehash(await hashPassword('Praise2026!'))).toBe(false)
    expect(needsRehash('scrypt$1024$8$1$c2FsdA$aGFzaA')).toBe(true)
    expect(needsRehash('bcrypt$whatever')).toBe(true)
  })
})

describe('opaque tokens', () => {
  it('produces unique, high-entropy tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken()))
    expect(tokens.size).toBe(200)
    expect(generateToken().length).toBeGreaterThanOrEqual(40)
  })

  it('hashes deterministically and compares in constant time', () => {
    const token = generateToken()
    expect(hashToken(token)).toBe(hashToken(token))
    expect(hashToken(token)).not.toBe(token)
    expect(tokensMatch(hashToken(token), hashToken(token))).toBe(true)
    expect(tokensMatch(hashToken(token), hashToken(generateToken()))).toBe(false)
  })
})

describe('role-based access control', () => {
  it('gives volunteers no administrative capability', () => {
    const volunteer = user(['VOLUNTEER'])
    expect(isAdmin(volunteer)).toBe(false)
    expect(can(volunteer, 'application:view_all')).toBe(false)
    expect(can(volunteer, 'health:view')).toBe(false)
    expect(can(volunteer, 'application:view_own')).toBe(true)
  })

  it('restricts health information to the medical officer and super admin', () => {
    expect(can(user(['MEDICAL_INFO_OFFICER']), 'health:view')).toBe(true)
    expect(can(user(['SUPER_ADMIN']), 'health:view')).toBe(true)
    expect(can(user(['REGISTRATION_ADMIN']), 'health:view')).toBe(false)
    expect(can(user(['DEPARTMENT_HEAD']), 'health:view')).toBe(false)
    expect(can(user(['REVIEWER']), 'health:view')).toBe(false)
    expect(can(user(['COMMUNICATION_OFFICER']), 'health:view')).toBe(false)
  })

  it('stops reviewers from deciding outcomes', () => {
    expect(can(user(['REVIEWER']), 'application:review')).toBe(true)
    expect(can(user(['REVIEWER']), 'application:decide')).toBe(false)
    expect(can(user(['REGISTRATION_ADMIN']), 'application:decide')).toBe(true)
  })

  it('scopes department heads to their own departments', () => {
    expect(departmentScope(user(['DEPARTMENT_HEAD'], ['dept_media']))).toEqual(['dept_media'])
    // null means "no restriction".
    expect(departmentScope(user(['REGISTRATION_ADMIN']))).toBeNull()
    expect(departmentScope(user(['SUPER_ADMIN']))).toBeNull()
    // A volunteer can see nothing at all, which must not be confused with "all".
    expect(departmentScope(user(['VOLUNTEER']))).toEqual([])
  })

  it('unions permissions when a user holds several roles', () => {
    const permissions = permissionsFor(['REVIEWER', 'MEDICAL_INFO_OFFICER'])
    expect(permissions.has('health:view')).toBe(true)
    expect(permissions.has('application:review')).toBe(true)
    expect(permissions.has('settings:manage')).toBe(false)
  })

  it('treats a null user as having no permissions', () => {
    expect(can(null, 'application:view_own')).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})

describe('upload content sniffing', () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(16),
  ])
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7', 'ascii'), Buffer.alloc(16)])

  it('identifies real image and document types', () => {
    expect(sniffMimeType(png)).toBe('image/png')
    expect(sniffMimeType(jpeg)).toBe('image/jpeg')
    expect(sniffMimeType(pdf)).toBe('application/pdf')
  })

  it('rejects a script disguised with an image extension', () => {
    const script = Buffer.from('<?php system($_GET["c"]); ?>                ', 'ascii')
    expect(sniffMimeType(script)).toBeNull()
  })

  it('rejects an HTML polyglot', () => {
    expect(sniffMimeType(Buffer.from('<html><script>alert(1)</script>', 'ascii'))).toBeNull()
  })

  it('rejects a file too short to identify', () => {
    expect(sniffMimeType(Buffer.from([0xff, 0xd8]))).toBeNull()
  })
})
