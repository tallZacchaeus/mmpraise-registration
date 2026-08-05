import type { Metadata } from 'next'
import Link from 'next/link'
import { Megaphone, Plus } from 'lucide-react'
import { Badge, buttonClass, Card, CardBody, EmptyState } from '@/components/ui/primitives'
import { promoteDueAnnouncements } from '@/lib/announcements/lifecycle'
import { departmentScope, requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { AnnouncementPriority, AnnouncementStatus } from '@/generated/prisma/enums'
import type { Prisma } from '@/generated/prisma/client'

export const metadata: Metadata = { title: 'Announcements' }

const TABS: { value: AnnouncementStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const STATUS_TONES: Record<AnnouncementStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  PUBLISHED: 'success',
  EXPIRED: 'warning',
  ARCHIVED: 'neutral',
}

const PRIORITY_TONES: Record<AnnouncementPriority, 'neutral' | 'info' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
}

const AUDIENCE_LABELS: Record<string, string> = {
  ALL_VOLUNTEERS: 'All volunteers',
  DEPARTMENT: 'One department',
  APPROVED_ONLY: 'Approved only',
}

const PER_PAGE = 20

/**
 * Every announcement, by where it is in its life.
 *
 * Promotion runs first, so "Scheduled" never shows something that is actually
 * live and "Published" never shows something that has expired — the lazy clock
 * ticks whenever anyone looks.
 */
export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const user = await requirePermission('announcement:manage')
  const scope = departmentScope(user)
  await promoteDueAnnouncements()

  const params = await searchParams
  const status = (TABS.find((tab) => tab.value === params.status)?.value ??
    'PUBLISHED') as AnnouncementStatus
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const scopeWhere: Prisma.AnnouncementWhereInput =
    scope === null ? {} : { departmentId: { in: scope.length ? scope : ['__none__'] } }

  const where: Prisma.AnnouncementWhereInput = {
    ...scopeWhere,
    status,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [items, total, counts] = await Promise.all([
    db.announcement.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        audience: true,
        publishedAt: true,
        scheduledFor: true,
        expiresAt: true,
        showAsBanner: true,
        createdAt: true,
        department: { select: { name: true } },
        createdBy: { select: { username: true } },
        _count: { select: { deliveries: true } },
      },
    }),
    db.announcement.count({ where }),
    db.announcement.groupBy({ by: ['status'], where: scopeWhere, _count: { _all: true } }),
  ])

  const countFor = (value: AnnouncementStatus) =>
    counts.find((row) => row.status === value)?._count._all ?? 0
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))

  const link = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { status, q, ...overrides }
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (!value) continue
      if (key === 'status' && value === 'PUBLISHED') continue
      next.set(key, value)
    }
    const qs = next.toString()
    return `/admin/announcements${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Announcements</h1>
          <p className="mt-1 text-body">
            Updates for volunteer dashboards — drafted, scheduled, published and retired here.
          </p>
        </div>
        <Link href="/admin/announcements/new" className={buttonClass({ size: 'sm' })}>
          <Plus aria-hidden className="size-4" />
          New announcement
        </Link>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={link({ status: tab.value, page: undefined })}
            aria-current={status === tab.value ? 'page' : undefined}
            className={buttonClass({
              variant: status === tab.value ? 'primary' : 'ghost',
              size: 'sm',
            })}
          >
            {tab.label} ({countFor(tab.value)})
          </Link>
        ))}
      </nav>

      <form action="/admin/announcements" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="status" value={status} />
        <div className="min-w-56 flex-1">
          <label
            htmlFor="announcement-q"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Search
          </label>
          <input
            id="announcement-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Words from the title or the announcement"
            className="min-h-11 w-full rounded-field border border-line-strong bg-surface px-4 py-2 text-sm text-body placeholder:text-muted/70 hover:border-muted focus:border-primary"
          />
        </div>
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          Apply
        </button>
      </form>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<Megaphone className="size-8" />}
              title="Nothing here"
              description={
                q
                  ? 'Nothing matches that search.'
                  : status === 'DRAFT'
                    ? 'Drafts you save will collect here until they are published.'
                    : 'No announcements with this status.'
              }
            />
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/announcements/${item.id}`}
                  className="block px-4 py-3 hover:bg-surface-sunken"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-ink">
                      {item.title}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {item.status === 'SCHEDULED' && item.scheduledFor
                        ? `goes live ${formatDate(item.scheduledFor, true)}`
                        : item.publishedAt
                          ? formatDate(item.publishedAt)
                          : formatDate(item.createdAt)}
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={STATUS_TONES[item.status]}>{item.status.toLowerCase()}</Badge>
                    {item.priority !== 'NORMAL' && (
                      <Badge tone={PRIORITY_TONES[item.priority]}>
                        {item.priority.toLowerCase()}
                      </Badge>
                    )}
                    {item.showAsBanner && <Badge tone="info">Highlighted</Badge>}
                    <span className="text-xs text-muted">
                      {item.department?.name ?? AUDIENCE_LABELS[item.audience] ?? item.audience}
                      {item.createdBy ? ` · ${item.createdBy.username}` : ''}
                      {item._count.deliveries > 0
                        ? ` · ${item._count.deliveries} email run${item._count.deliveries === 1 ? '' : 's'}`
                        : ''}
                      {item.status === 'PUBLISHED' && item.expiresAt
                        ? ` · until ${formatDate(item.expiresAt, true)}`
                        : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between gap-3 border-t border-line px-4 py-3"
          >
            <p className="text-xs text-muted">
              Page {page} of {pages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={link({ page: String(page - 1) })}
                  className={buttonClass({ variant: 'ghost', size: 'sm' })}
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={link({ page: String(page + 1) })}
                  className={buttonClass({ variant: 'ghost', size: 'sm' })}
                >
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
      </Card>
    </div>
  )
}
