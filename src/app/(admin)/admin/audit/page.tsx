import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardBody, CardHeader, EmptyState, buttonClass } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Audit log' }

const PER_PAGE = 50

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>
}) {
  await requirePermission('audit:view')
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1))

  const where = params.action ? { action: params.action } : {}

  const [total, entries, actions] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { actor: { select: { username: true, email: true } } },
    }),
    db.auditLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { _count: { action: 'desc' } }, take: 20 }),
  ])

  const pages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Audit log</h1>
        <p className="mt-1 text-body">
          Every security-relevant action, including each time restricted health information was viewed.
        </p>
      </div>

      <Card>
        <CardHeader title="Filter by action" />
        <CardBody>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/admin/audit"
                className={buttonClass({ variant: params.action ? 'ghost' : 'primary', size: 'sm' })}
              >
                All ({total})
              </Link>
            </li>
            {actions.map((row) => (
              <li key={row.action}>
                <Link
                  href={`/admin/audit?action=${encodeURIComponent(row.action)}`}
                  className={buttonClass({
                    variant: params.action === row.action ? 'primary' : 'ghost',
                    size: 'sm',
                  })}
                >
                  {row.action} ({row._count._all})
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <CardBody>
            <EmptyState title="No audit entries" description="Actions will appear here as administrators use the system." />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <caption className="sr-only">Audit log entries</caption>
              <thead>
                <tr className="border-b border-line bg-surface-sunken">
                  <th scope="col" className="px-4 py-3 font-display text-xs font-bold uppercase text-ink">When</th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-bold uppercase text-ink">Who</th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-bold uppercase text-ink">Action</th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-bold uppercase text-ink">Entity</th>
                  <th scope="col" className="px-4 py-3 font-display text-xs font-bold uppercase text-ink">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-body">{formatDate(entry.createdAt, true)}</td>
                    <td className="px-4 py-2.5 text-body">{entry.actor?.username ?? 'System'}</td>
                    <td className="px-4 py-2.5">
                      <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs">{entry.action}</code>
                    </td>
                    <td className="px-4 py-2.5 text-body">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId.slice(-8)}` : ''}
                    </td>
                    <td className="max-w-sm truncate px-4 py-2.5 text-xs text-muted">
                      {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/audit?page=${page - 1}${params.action ? `&action=${params.action}` : ''}`}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/admin/audit?page=${page + 1}${params.action ? `&action=${params.action}` : ''}`}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
