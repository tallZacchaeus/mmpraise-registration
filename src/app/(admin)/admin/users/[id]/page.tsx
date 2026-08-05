import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { RoleForm } from '@/components/admin/role-form'
import { AdminAccessControls } from '@/components/admin/users/admin-access-controls'
import { PermissionMatrix, type PermissionRow } from '@/components/admin/users/permission-matrix'
import { Badge, buttonClass, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import {
  adminAccessSuspended,
  effectivePermissions,
  PERMISSIONS,
  permissionsFor,
  requirePermission,
} from '@/lib/auth/rbac'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { db } from '@/lib/db'
import { getDepartments } from '@/lib/reference'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Administrator' }

/**
 * One administrator: their roles, their exact permissions, their access, and
 * every change anyone has ever made to them.
 *
 * All four already existed in the schema and none had an interface, so granting
 * a single permission or suspending somebody for a fortnight was a database
 * operation. That is the gap this page closes.
 */
export default async function AdministratorPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('user:manage')
  const { id } = await params

  const admin = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      mmpCode: true,
      createdAt: true,
      lastLoginAt: true,
      adminDisabledAt: true,
      adminSuspendedUntil: true,
      roles: { select: { role: true } },
      departmentScopes: { select: { departmentId: true, department: { select: { name: true } } } },
      profile: { select: { firstName: true, lastName: true } },
      permissionGrants: {
        select: { permission: true, granted: true, reason: true, createdAt: true },
      },
    },
  })
  if (!admin) notFound()

  const [departments, history] = await Promise.all([
    getDepartments(),
    db.roleAssignmentHistory.findMany({
      where: { userId: admin.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { username: true } } },
    }),
  ])

  const roles = admin.roles.map((r) => r.role)
  const overrides = admin.permissionGrants.map((grant) => ({
    permission: grant.permission,
    granted: grant.granted,
  }))
  const fromRoles = permissionsFor(roles)
  const effective = effectivePermissions(roles, overrides)
  const overrideFor = (permission: string) =>
    admin.permissionGrants.find((grant) => grant.permission === permission)?.granted ?? null

  const rows: PermissionRow[] = PERMISSIONS.map((permission) => ({
    permission,
    fromRole: fromRoles.has(permission),
    override: overrideFor(permission),
    effective: effective.has(permission),
  }))

  const suspended = adminAccessSuspended({
    adminDisabledAt: admin.adminDisabledAt,
    adminSuspendedUntil: admin.adminSuspendedUntil,
  })
  const isSelf = actor.id === admin.id
  const name = admin.profile
    ? `${admin.profile.firstName} ${admin.profile.lastName}`
    : admin.username

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/users" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft aria-hidden className="size-4" />
          All administrators
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-3xl">{name}</h1>
        {admin.adminDisabledAt ? (
          <Badge tone="danger">Disabled</Badge>
        ) : suspended ? (
          <Badge tone="warning">Suspended until {formatDate(admin.adminSuspendedUntil!)}</Badge>
        ) : (
          <Badge tone="success">Active</Badge>
        )}
      </div>
      <p className="text-sm text-muted">
        {admin.email} · {admin.username}
        {admin.mmpCode ? ` · ${admin.mmpCode}` : ''} · last signed in{' '}
        {formatDate(admin.lastLoginAt) ?? 'never'} · account created{' '}
        {formatDate(admin.createdAt)}
      </p>

      {/*
        `min-w-0` is load-bearing: a grid item defaults to `min-width: auto`,
        so the permission table's min-content width grew the track past the
        viewport and the phone zoomed the whole page out to fit. The table
        scrolls inside its own container instead.
      */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="Permissions"
              description="What the roles give, and anything added or withheld for this person alone."
            />
            <CardBody>
              <PermissionMatrix
                userId={admin.id}
                rows={rows}
                disabled={
                  isSelf
                    ? 'These are your own permissions. Another administrator has to change them — an administrator who can widen their own access effectively has all of it.'
                    : undefined
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="History"
              description="Every role and permission change, and who made it."
            />
            <CardBody>
              {history.length === 0 ? (
                <p className="text-sm text-muted">
                  Nothing recorded yet. Changes made from here on appear in this list.
                </p>
              ) : (
                <ol className="space-y-2">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-baseline justify-between gap-3 rounded-field bg-surface-sunken px-4 py-2 text-sm"
                    >
                      <span className="text-body">
                        <Badge tone={entry.change === 'GRANTED' ? 'success' : 'danger'}>
                          {entry.change === 'GRANTED' ? 'Given' : 'Taken'}
                        </Badge>{' '}
                        {ROLE_LABELS[entry.subject as keyof typeof ROLE_LABELS] ?? entry.subject}
                        {entry.reason ? ` — ${entry.reason}` : ''}
                      </span>
                      <span className="text-xs text-muted">
                        {entry.actor?.username ?? 'system'} · {formatDate(entry.createdAt, true)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Roles" />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {roles
                  .filter((role) => role !== 'VOLUNTEER')
                  .map((role) => (
                    <Badge key={role} tone="brand">
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                {admin.departmentScopes.map((scope) => (
                  <Badge key={scope.departmentId} tone="info">
                    {scope.department.name}
                  </Badge>
                ))}
                {roles.filter((role) => role !== 'VOLUNTEER').length === 0 && (
                  <span className="text-sm text-muted">No administrative roles.</span>
                )}
              </div>
              <RoleForm
                departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                initialEmail={admin.email}
                initialRoles={roles.filter((role) => role !== 'VOLUNTEER')}
                initialDepartmentIds={admin.departmentScopes.map((scope) => scope.departmentId)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Access"
              description="Withdraw or restore the administration side without touching their volunteer account."
            />
            <CardBody>
              <AdminAccessControls
                userId={admin.id}
                disabledAt={admin.adminDisabledAt}
                suspended={suspended && !admin.adminDisabledAt}
                isSelf={isSelf}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
