import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { RoleForm } from '@/components/admin/role-form'
import {
  Badge,
  buttonClass,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
} from '@/components/ui/primitives'
import { adminAccessSuspended, requirePermission } from '@/lib/auth/rbac'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { db } from '@/lib/db'
import { getDepartments } from '@/lib/reference'
import { formatDate } from '@/lib/utils'
import type { Prisma, Role } from '@/generated/prisma/client'

export const metadata: Metadata = { title: 'Administrators' }

const STATUSES = ['all', 'active', 'suspended', 'disabled'] as const
type Status = (typeof STATUSES)[number]

/**
 * Everyone who can act on the administration side, and what they may do.
 *
 * Searchable and filterable because the answer to "who can export volunteer
 * data?" should not require reading every row — and because that question is
 * asked in exactly the moments when it matters most.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>
}) {
  await requirePermission('user:manage')
  const params = await searchParams

  const q = params.q?.trim() ?? ''
  const role = (Object.keys(ROLE_LABELS) as Role[]).find((value) => value === params.role)
  const status = (STATUSES.find((value) => value === params.status) ?? 'all') as Status
  const now = new Date()

  const where: Prisma.UserWhereInput = {
    roles: role ? { some: { role } } : { some: { role: { not: 'VOLUNTEER' } } },
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
            { profile: { firstName: { contains: q, mode: 'insensitive' } } },
            { profile: { lastName: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(status === 'disabled'
      ? { adminDisabledAt: { not: null } }
      : status === 'suspended'
        ? { adminDisabledAt: null, adminSuspendedUntil: { gt: now } }
        : status === 'active'
          ? {
              adminDisabledAt: null,
              OR: [{ adminSuspendedUntil: null }, { adminSuspendedUntil: { lte: now } }],
            }
          : {}),
  }

  const [admins, departments] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        username: true,
        lastLoginAt: true,
        adminDisabledAt: true,
        adminSuspendedUntil: true,
        roles: { select: { role: true } },
        departmentScopes: { select: { department: { select: { name: true } } } },
        profile: { select: { firstName: true, lastName: true } },
        _count: { select: { permissionGrants: true } },
      },
    }),
    getDepartments(),
  ])

  const link = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { q, role, status, ...overrides }
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (!value || (key === 'status' && value === 'all')) continue
      next.set(key, value)
    }
    const qs = next.toString()
    return `/admin/users${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Administrators</h1>
        <p className="mt-1 text-body">
          Who can act on the administration side, what they may do, and when access was withdrawn.
        </p>
      </div>

      <nav aria-label="Filter by access" className="flex flex-wrap gap-2">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={link({ status: value })}
            aria-current={status === value ? 'page' : undefined}
            className={buttonClass({ variant: status === value ? 'primary' : 'ghost', size: 'sm' })}
          >
            {value === 'all' ? 'Everyone' : value.charAt(0).toUpperCase() + value.slice(1)}
          </Link>
        ))}
      </nav>

      <form action="/admin/users" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="status" value={status} />
        <div className="min-w-56 flex-1">
          <label
            htmlFor="admin-q"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Search
          </label>
          <input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, username or email"
            className="min-h-11 w-full rounded-field border border-line-strong bg-surface px-4 py-2 text-sm text-body placeholder:text-muted/70 hover:border-muted focus:border-primary"
          />
        </div>
        <div>
          <label
            htmlFor="admin-role"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Role
          </label>
          <select
            id="admin-role"
            name="role"
            defaultValue={role ?? ''}
            className="min-h-11 rounded-field border border-line-strong bg-surface px-3 py-2 text-sm text-body"
          >
            <option value="">All roles</option>
            {(Object.entries(ROLE_LABELS) as [Role, string][])
              .filter(([value]) => value !== 'VOLUNTEER')
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </div>
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          Apply
        </button>
      </form>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title="Administrators"
            description={`${admins.length} account${admins.length === 1 ? '' : 's'}.`}
          />
          <CardBody>
            {admins.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="size-8" />}
                title="Nobody here"
                description={q ? 'Nothing matches that search.' : 'No administrators with this access.'}
              />
            ) : (
              <ul className="divide-y divide-line">
                {admins.map((admin) => {
                  const suspended = adminAccessSuspended(
                    {
                      adminDisabledAt: admin.adminDisabledAt,
                      adminSuspendedUntil: admin.adminSuspendedUntil,
                    },
                    now,
                  )
                  return (
                    <li key={admin.id}>
                      <Link
                        href={`/admin/users/${admin.id}`}
                        className="block py-3 hover:bg-surface-sunken"
                      >
                        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                          {admin.profile
                            ? `${admin.profile.firstName} ${admin.profile.lastName}`
                            : admin.username}
                          {admin.adminDisabledAt ? (
                            <Badge tone="danger">Disabled</Badge>
                          ) : suspended ? (
                            <Badge tone="warning">
                              Suspended until {formatDate(admin.adminSuspendedUntil!)}
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted">
                          {admin.email} · last signed in {formatDate(admin.lastLoginAt) ?? 'never'}
                          {admin._count.permissionGrants > 0
                            ? ` · ${admin._count.permissionGrants} permission override${admin._count.permissionGrants === 1 ? '' : 's'}`
                            : ''}
                        </p>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {admin.roles
                            .filter((r) => r.role !== 'VOLUNTEER')
                            .map((r) => (
                              <Badge key={r.role} tone="brand">
                                {ROLE_LABELS[r.role]}
                              </Badge>
                            ))}
                          {admin.departmentScopes.map((scope) => (
                            <Badge key={scope.department.name} tone="info">
                              {scope.department.name}
                            </Badge>
                          ))}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Assign roles"
            description="By email address. Roles replace whatever the account had before."
          />
          <CardBody>
            <RoleForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
