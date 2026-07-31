import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'
import { getAnalytics } from '@/lib/admin/queries'
import { STATUS_LABELS } from '@/lib/applications/status'
import { AGE_RANGES } from '@/lib/validation/registration'
import type { ApplicationStatus } from '@/generated/prisma/enums'

export const metadata: Metadata = { title: 'Administration overview' }

/**
 * Registration analytics.
 * Bars are plain divs sized by percentage — no chart library, so the page stays
 * fast and the numbers are readable to a screen reader.
 */
export default async function AdminOverviewPage() {
  const user = await requirePermission('application:review')
  const analytics = await getAnalytics(user)

  const maxDepartment = Math.max(1, ...analytics.byDepartment.map((d) => d.count))
  const maxCountry = Math.max(1, ...analytics.byCountry.map((c) => c.count))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Overview</h1>
        <p className="mt-1 text-body">Registration activity across the volunteers you can see.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total applications" value={analytics.total} />
        <Stat label="Submitted this week" value={analytics.recent} />
        <Stat
          label="Awaiting review"
          value={
            analytics.byStatus
              .filter((s) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW')
              .reduce((sum, s) => sum + s.count, 0)
          }
        />
        <Stat
          label="Approved"
          value={
            analytics.byStatus
              .filter((s) => s.status === 'APPROVED' || s.status === 'ASSIGNED')
              .reduce((sum, s) => sum + s.count, 0)
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="By status" />
          <CardBody>
            <ul className="space-y-2">
              {analytics.byStatus.length === 0 && <li className="text-sm text-muted">No applications yet.</li>}
              {analytics.byStatus.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-4 text-sm">
                  <Link
                    href={`/admin/applications?status=${row.status}`}
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    {STATUS_LABELS[row.status as ApplicationStatus]}
                  </Link>
                  <span className="font-display text-lg font-bold text-ink">{row.count}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By department" />
          <CardBody>
            <ul className="space-y-3">
              {analytics.byDepartment.length === 0 && <li className="text-sm text-muted">No applications yet.</li>}
              {analytics.byDepartment.map((row) => (
                <li key={row.department?.id ?? 'none'}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-medium text-ink">{row.department?.name ?? 'Unassigned'}</span>
                    <span className="text-muted">
                      {row.count}
                      {row.department?.capacity ? ` / ${row.department.capacity}` : ''}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-pill bg-line" role="presentation">
                    <div
                      className="h-full rounded-pill bg-primary"
                      style={{ width: `${Math.round((row.count / maxDepartment) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top countries" />
          <CardBody>
            <ul className="space-y-3">
              {analytics.byCountry.length === 0 && <li className="text-sm text-muted">No applications yet.</li>}
              {analytics.byCountry.map((row) => (
                <li key={row.country}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-medium text-ink">{row.country}</span>
                    <span className="text-muted">{row.count}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-pill bg-line" role="presentation">
                    <div
                      className="h-full rounded-pill bg-brand"
                      style={{ width: `${Math.round((row.count / maxCountry) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By age range" />
          <CardBody>
            <ul className="grid gap-2 sm:grid-cols-2">
              {analytics.byAgeRange.length === 0 && <li className="text-sm text-muted">No applications yet.</li>}
              {analytics.byAgeRange.map((row) => (
                <li key={row.ageRange ?? 'unknown'} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-body">
                    {AGE_RANGES.find((a) => a.value === row.ageRange)?.label ?? 'Not given'}
                  </span>
                  <span className="font-semibold text-ink">{row.count}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 font-display text-3xl font-bold text-ink">{value}</p>
      </CardBody>
    </Card>
  )
}
