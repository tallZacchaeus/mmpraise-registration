import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageSquareQuote, Star } from 'lucide-react'
import { BulkRejectTestData } from '@/components/admin/testimonies/bulk-reject-test-data'
import { Badge, buttonClass, Card, CardBody, EmptyState } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { SubmissionStatus } from '@/generated/prisma/enums'
import type { Prisma } from '@/generated/prisma/client'

export const metadata: Metadata = { title: 'Testimony moderation' }

const TABS: { value: SubmissionStatus; label: string }[] = [
  { value: 'PENDING', label: 'Awaiting review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Not published' },
]

const TONES: Record<SubmissionStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

const SOURCES = [
  { value: 'real', label: 'Real submissions' },
  { value: 'test', label: 'Test data' },
  { value: 'all', label: 'Everything' },
] as const

const PER_PAGE = 25

/**
 * The moderation queue.
 *
 * A table, not a wall of cards: with a hundred pending, the moderator's first
 * job is triage — what is real, what is duplicated, what has somebody already
 * picked up — and triage needs rows that can be scanned. Reading and deciding
 * happen on the detail page, one submission at a time.
 *
 * Test data is hidden by default. Mixed into the queue it drowns the real
 * submissions, which is precisely how 103 "pending" testimonies stopped
 * meaning anything.
 */
export default async function TestimonyModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; source?: string; page?: string }>
}) {
  await requirePermission('testimony:moderate')
  const params = await searchParams

  const status = (TABS.find((tab) => tab.value === params.status)?.value ?? 'PENDING') as SubmissionStatus
  const source = SOURCES.find((s) => s.value === params.source)?.value ?? 'real'
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const where: Prisma.TestimonySubmissionWhereInput = {
    status,
    ...(source === 'real' ? { isTestData: false } : source === 'test' ? { isTestData: true } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { authorName: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
            { country: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [items, total, counts, pendingTestData, duplicateHashes] = await Promise.all([
    db.testimonySubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        title: true,
        authorName: true,
        isAnonymous: true,
        country: true,
        createdAt: true,
        status: true,
        isSpam: true,
        isTestData: true,
        featuredAt: true,
        bodyHash: true,
        assignedTo: { select: { username: true } },
        _count: { select: { notes: true } },
      },
    }),
    db.testimonySubmission.count({ where }),
    db.testimonySubmission.groupBy({
      by: ['status'],
      where: source === 'real' ? { isTestData: false } : source === 'test' ? { isTestData: true } : {},
      _count: { _all: true },
    }),
    db.testimonySubmission.count({ where: { status: 'PENDING', isTestData: true } }),
    /*
     * Hashes that occur more than once, anywhere. A duplicate matters whichever
     * page its twin sits on, so this is computed globally, not per page.
     */
    db.testimonySubmission.groupBy({
      by: ['bodyHash'],
      where: { bodyHash: { not: null } },
      _count: { _all: true },
      having: { bodyHash: { _count: { gt: 1 } } },
    }),
  ])

  const duplicates = new Set(duplicateHashes.map((row) => row.bodyHash))
  const countFor = (value: SubmissionStatus) =>
    counts.find((row) => row.status === value)?._count._all ?? 0
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))

  const link = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { status, q, source, ...overrides }
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      // Defaults stay out of the URL so the address is shareable and short.
      if (!value) continue
      if (key === 'source' && value === 'real') continue
      if (key === 'status' && value === 'PENDING') continue
      next.set(key, value)
    }
    const qs = next.toString()
    return `/admin/testimonies${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Testimonies</h1>
          <p className="mt-1 text-body">
            Submissions from the homepage. Nothing is shown publicly until you approve it.
          </p>
        </div>
        {pendingTestData > 0 && <BulkRejectTestData count={pendingTestData} />}
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={link({ status: tab.value, page: undefined })}
            aria-current={status === tab.value ? 'page' : undefined}
            className={buttonClass({ variant: status === tab.value ? 'primary' : 'ghost', size: 'sm' })}
          >
            {tab.label} ({countFor(tab.value)})
          </Link>
        ))}
      </nav>

      <form action="/admin/testimonies" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="status" value={status} />
        <div className="min-w-56 flex-1">
          <label
            htmlFor="testimony-q"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Search
          </label>
          <input
            id="testimony-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Title, name, country or words from the testimony"
            className="min-h-11 w-full rounded-field border border-line-strong bg-surface px-4 py-2 text-sm text-body placeholder:text-muted/70 hover:border-muted focus:border-primary"
          />
        </div>
        <div>
          <label
            htmlFor="testimony-source"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Source
          </label>
          <select
            id="testimony-source"
            name="source"
            defaultValue={source}
            className="min-h-11 rounded-field border border-line-strong bg-surface px-3 py-2 text-sm text-body"
          >
            {SOURCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          Apply
        </button>
      </form>

      {items.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<MessageSquareQuote className="size-8" />}
              title="Nothing here"
              description={
                q
                  ? 'Nothing matches that search. Try fewer words, or check the other status tabs.'
                  : status === 'PENDING'
                    ? 'New testimonies from the homepage will appear here for review.'
                    : 'No testimonies with this status yet.'
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* `relative` so the scroll box clips its absolute (sr-only) descendants. */}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Testimony submissions, page {page} of {pages}
              </caption>
              <thead>
                <tr className="border-b border-line bg-surface-sunken">
                  <Th>Testimony</Th>
                  <Th>Country</Th>
                  <Th>Submitted</Th>
                  <Th>Assigned</Th>
                  <Th>Notes</Th>
                  <Th>Flags</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface-sunken">
                    <td className="max-w-72 px-4 py-3">
                      <Link
                        href={`/admin/testimonies/${item.id}`}
                        className="block truncate font-semibold text-primary underline underline-offset-4"
                      >
                        {item.title ?? 'Untitled testimony'}
                      </Link>
                      <span className="block truncate text-xs text-muted">
                        {item.isAnonymous ? 'Anonymous' : item.authorName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-body">{item.country}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-body">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-body">{item.assignedTo?.username ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-body">
                      {item._count.notes > 0 ? item._count.notes : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-1">
                        {item.featuredAt && (
                          <Badge tone="brand">
                            <Star aria-hidden className="size-3" /> Featured
                          </Badge>
                        )}
                        {item.bodyHash && duplicates.has(item.bodyHash) && (
                          <Badge tone="warning">Duplicate</Badge>
                        )}
                        {item.isSpam && <Badge tone="danger">Spam</Badge>}
                        {item.isTestData && <Badge tone="neutral">Test</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={TONES[item.status]}>{item.status.toLowerCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Page {page} of {pages} · {total} {total === 1 ? 'submission' : 'submissions'}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={link({ page: String(page - 1) })}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={link({ page: String(page + 1) })}
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 font-display text-xs font-bold uppercase tracking-wide text-ink"
    >
      {children}
    </th>
  )
}
