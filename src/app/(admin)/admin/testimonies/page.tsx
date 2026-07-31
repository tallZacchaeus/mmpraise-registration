import type { Metadata } from 'next'
import Link from 'next/link'
import { ModerationActions } from '@/components/admin/moderation-actions'
import { Badge, buttonClass, Card, CardBody, CardHeader, EmptyState } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { SubmissionStatus } from '@/generated/prisma/enums'

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

/**
 * Moderation queue for testimonies submitted from the homepage.
 * Nothing submitted by the public appears on the site until it is approved here.
 */
export default async function TestimonyModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requirePermission('application:review')
  const params = await searchParams

  const status = (TABS.find((tab) => tab.value === params.status)?.value ?? 'PENDING') as SubmissionStatus

  const [submissions, counts] = await Promise.all([
    db.testimonySubmission.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { reviewedBy: { select: { username: true } } },
    }),
    db.testimonySubmission.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const countFor = (value: SubmissionStatus) =>
    counts.find((row) => row.status === value)?._count._all ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Testimonies</h1>
        <p className="mt-1 text-body">
          Submissions from the homepage. Nothing is shown publicly until you approve it.
        </p>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/testimonies?status=${tab.value}`}
            aria-current={status === tab.value ? 'page' : undefined}
            className={buttonClass({ variant: status === tab.value ? 'primary' : 'ghost', size: 'sm' })}
          >
            {tab.label} ({countFor(tab.value)})
          </Link>
        ))}
      </nav>

      {submissions.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Nothing here"
              description={
                status === 'PENDING'
                  ? 'New testimonies from the homepage will appear here for review.'
                  : 'No testimonies with this status yet.'
              }
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-4">
          {submissions.map((submission) => (
            <li key={submission.id}>
              <Card>
                <CardHeader
                  title={submission.title ?? 'Untitled testimony'}
                  description={`${submission.isAnonymous ? 'Anonymous' : submission.authorName} · ${submission.country} · ${formatDate(submission.createdAt, true)}`}
                  action={<Badge tone={TONES[submission.status]}>{submission.status.toLowerCase()}</Badge>}
                />
                <CardBody className="space-y-4">
                  <p className="whitespace-pre-line text-body">{submission.body}</p>

                  <dl className="grid gap-x-8 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted">Contact email</dt>
                      <dd className="break-words text-ink">{submission.email}</dd>
                    </div>
                    {submission.phone && (
                      <div>
                        <dt className="text-muted">Phone</dt>
                        <dd className="text-ink">{submission.phone}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-muted">Publish anonymously</dt>
                      <dd className="text-ink">{submission.isAnonymous ? 'Yes' : 'No'}</dd>
                    </div>
                    {submission.reviewedBy && (
                      <div>
                        <dt className="text-muted">Reviewed by</dt>
                        <dd className="text-ink">
                          {submission.reviewedBy.username} · {formatDate(submission.reviewedAt, true)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {submission.reviewNote && (
                    <p className="rounded-field bg-surface-sunken px-4 py-3 text-sm text-body">
                      <span className="font-semibold text-ink">Review note: </span>
                      {submission.reviewNote}
                    </p>
                  )}

                  <ModerationActions id={submission.id} status={submission.status} />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
