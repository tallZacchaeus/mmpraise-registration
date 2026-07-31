import type { Metadata } from 'next'
import { RoleForm } from '@/components/admin/role-form'
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { db } from '@/lib/db'
import { getDepartments } from '@/lib/reference'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Administrators' }

export default async function AdminUsersPage() {
  await requirePermission('user:manage')

  const [admins, departments] = await Promise.all([
    db.user.findMany({
      where: { roles: { some: { role: { not: 'VOLUNTEER' } } } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        username: true,
        lastLoginAt: true,
        roles: { select: { role: true } },
        departmentScopes: { select: { department: { select: { name: true } } } },
        profile: { select: { firstName: true, lastName: true } },
      },
    }),
    getDepartments(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Administrators</h1>
        <p className="mt-1 text-body">Grant and remove administrative roles, and scope department heads.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Assign roles" />
          <CardBody>
            <RoleForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Current administrators" description={`${admins.length} account${admins.length === 1 ? '' : 's'}.`} />
          <CardBody>
            {admins.length === 0 ? (
              <EmptyState title="No administrators yet" />
            ) : (
              <ul className="space-y-4">
                {admins.map((admin) => (
                  <li key={admin.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                    <p className="font-medium text-ink">
                      {admin.profile ? `${admin.profile.firstName} ${admin.profile.lastName}` : admin.username}
                    </p>
                    <p className="text-xs text-muted">
                      {admin.email} · last signed in {formatDate(admin.lastLoginAt) ?? 'never'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
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
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
