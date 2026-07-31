import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { DepartmentRow } from '@/components/admin/department-row'
import { buttonClass, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { can, requirePermission } from '@/lib/auth/rbac'
import { getDepartmentsWithLoad } from '@/lib/reference'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Departments and questions' }

export default async function DepartmentsPage() {
  const user = await requirePermission('question:manage')
  const departments = await getDepartmentsWithLoad()

  const questionCounts = await db.departmentQuestion.groupBy({
    by: ['departmentId'],
    where: { isActive: true },
    _count: { _all: true },
  })
  const counts = new Map(questionCounts.map((row) => [row.departmentId, row._count._all]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Departments and questions</h1>
        <p className="mt-1 text-body">
          Set capacity, open or close a department, and edit the questions volunteers are asked.
        </p>
      </div>

      <Card>
        <CardHeader title="Departments" />
        <CardBody>
          <ul className="space-y-3">
            {departments.map((department) => (
              <li
                key={department.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-field border border-line p-4"
              >
                <div className="min-w-0">
                  <p className="font-display text-base font-bold uppercase text-ink">{department.name}</p>
                  <p className="text-sm text-muted">
                    {department.applied} applied
                    {department.capacity ? ` of ${department.capacity}` : ''} ·{' '}
                    {counts.get(department.id) ?? 0} question{(counts.get(department.id) ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {can(user, 'department:manage') && (
                    <DepartmentRow
                      departmentId={department.id}
                      capacity={department.capacity}
                      isActive
                    />
                  )}
                  <Link
                    href={`/admin/departments/${department.id}/questions`}
                    className={buttonClass({ variant: 'secondary', size: 'sm' })}
                  >
                    <ClipboardList aria-hidden className="size-4" />
                    Questions
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
