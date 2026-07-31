import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, FileSpreadsheet } from 'lucide-react'
import { ApplicationFilters } from '@/components/admin/application-filters'
import { Badge, buttonClass, Card, CardBody, EmptyState } from '@/components/ui/primitives'
import { can, requirePermission } from '@/lib/auth/rbac'
import { listApplications, type ApplicationFilters as Filters } from '@/lib/admin/queries'
import { STATUS_LABELS, STATUS_TONES } from '@/lib/applications/status'
import { getChurchRegions, getCountries, getDepartments } from '@/lib/reference'
import { formatDate, initials } from '@/lib/utils'
import { AGE_RANGES } from '@/lib/validation/registration'

export const metadata: Metadata = { title: 'Applicants' }

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const user = await requirePermission('application:review')
  const params = await searchParams

  const filters: Filters = {
    q: params.q,
    status: params.status,
    departmentId: params.departmentId,
    countryId: params.countryId,
    churchRegionId: params.churchRegionId,
    ageRange: params.ageRange,
    page: params.page ? Number(params.page) : 1,
    sort: (params.sort as Filters['sort']) ?? 'newest',
  }

  const [result, departments, countries, regions] = await Promise.all([
    listApplications(user, filters),
    getDepartments(),
    getCountries(),
    getChurchRegions(),
  ])

  const exportQuery = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
  ).toString()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Applicants</h1>
          <p className="mt-1 text-body">
            {result.total} application{result.total === 1 ? '' : 's'} match your filters.
          </p>
        </div>

        {can(user, 'application:export') && (
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/admin/export?format=csv&${exportQuery}`}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              <Download aria-hidden className="size-4" />
              Export CSV
            </a>
            <a
              href={`/api/admin/export?format=xlsx&${exportQuery}`}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              <FileSpreadsheet aria-hidden className="size-4" />
              Export Excel
            </a>
          </div>
        )}
      </div>

      <ApplicationFilters
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        countries={countries.map((c) => ({ id: c.id, name: c.name }))}
        regions={regions}
      />

      {result.items.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No applicants found"
              description="Try widening your filters, or clear them to see every application you can access."
            />
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Horizontal scroll is confined to the table so the page never scrolls sideways. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Volunteer applications, page {result.page} of {result.pages}
              </caption>
              <thead>
                <tr className="border-b border-line bg-surface-sunken">
                  <Th>Volunteer</Th>
                  <Th>Registration ID</Th>
                  <Th>Department</Th>
                  <Th>Location</Th>
                  <Th>Age</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => {
                  const profile = item.user.profile
                  return (
                    <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface-sunken">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/applications/${item.id}`}
                          className="flex items-center gap-3 font-semibold text-primary underline underline-offset-4"
                        >
                          {profile?.photoDocumentId ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/files/${profile.photoDocumentId}`}
                              alt=""
                              className="size-9 shrink-0 rounded-full border border-line object-cover"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
                            >
                              {initials(profile?.firstName, profile?.lastName)}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate">
                              {profile?.firstName} {profile?.lastName}
                            </span>
                            <span className="block truncate text-xs font-normal text-muted">{item.user.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-body">{item.registrationId}</td>
                      <td className="px-4 py-3 text-body">{item.department?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-body">
                        {[profile?.city, profile?.state?.name, profile?.country?.name].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-body">
                        {AGE_RANGES.find((a) => a.value === profile?.ageRange)?.label ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-body">{formatDate(item.submittedAt)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {result.pages > 1 && <Pagination page={result.page} pages={result.pages} params={params} />}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wide text-ink">
      {children}
    </th>
  )
}

function Pagination({
  page,
  pages,
  params,
}: {
  page: number
  pages: number
  params: Record<string, string | undefined>
}) {
  const link = (target: number) => {
    const next = new URLSearchParams(
      Object.entries(params).filter(([key, value]) => Boolean(value) && key !== 'page') as [string, string][],
    )
    next.set('page', String(target))
    return `/admin/applications?${next.toString()}`
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Page {page} of {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={link(page - 1)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={link(page + 1)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            Next
          </Link>
        )}
      </div>
    </nav>
  )
}
