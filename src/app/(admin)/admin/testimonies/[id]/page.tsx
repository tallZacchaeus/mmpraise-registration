import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lock, Quote } from 'lucide-react'
import { ModerationActions } from '@/components/admin/moderation-actions'
import { TestimonyControls } from '@/components/admin/testimonies/testimony-controls'
import { TestimonyNoteForm } from '@/components/admin/testimonies/testimony-note-form'
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui/primitives'
import { audit } from '@/lib/audit'
import { can, requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { SubmissionStatus } from '@/generated/prisma/enums'

export const metadata: Metadata = { title: 'Testimony' }

const TONES: Record<SubmissionStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}

/**
 * One testimony: read it, see how it would look published, decide.
 *
 * Contact details are behind their own permission. Reading somebody's story is
 * the moderator's job; reading their phone number is only needed when replying,
 * and a public-submission inbox is exactly where minimal exposure matters.
 */
export default async function TestimonyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('testimony:moderate')
  const { id } = await params

  const submission = await db.testimonySubmission.findUnique({
    where: { id },
    include: {
      reviewedBy: { select: { username: true } },
      assignedTo: { select: { id: true, username: true } },
      notes: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { username: true } } },
      },
    },
  })
  if (!submission) notFound()

  const duplicates = submission.bodyHash
    ? await db.testimonySubmission.findMany({
        where: { bodyHash: submission.bodyHash, id: { not: submission.id } },
        select: { id: true, title: true, authorName: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
    : []

  const showContact = can(user, 'testimony:contact_view')
  if (showContact) {
    // The card says access is recorded; this is what makes that true.
    await audit({
      action: 'testimony.contact_viewed',
      entityType: 'TestimonySubmission',
      entityId: submission.id,
      actorId: user.id,
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/testimonies"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-active underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to the queue
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl">{submission.title ?? 'Untitled testimony'}</h1>
            <p className="mt-1 text-sm text-muted">
              {submission.isAnonymous ? 'Anonymous' : submission.authorName} · {submission.country} ·{' '}
              {formatDate(submission.createdAt, true)}
            </p>
          </div>
          <Badge tone={TONES[submission.status]}>{submission.status.toLowerCase()}</Badge>
        </div>
      </div>

      {duplicates.length > 0 && (
        <Card>
          <CardHeader
            title={`Same words, ${duplicates.length === 1 ? 'one other submission' : `${duplicates.length} other submissions`}`}
            description="Byte-for-byte the same testimony after normalising spacing. Usually a double-click, occasionally a copy-paste campaign."
          />
          <CardBody className="py-3">
            <ul className="divide-y divide-line">
              {duplicates.map((duplicate) => (
                <li key={duplicate.id}>
                  <Link
                    href={`/admin/testimonies/${duplicate.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:bg-surface-sunken"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-ink">{duplicate.title ?? 'Untitled'}</span>
                      <span className="text-muted"> — {duplicate.authorName}, {formatDate(duplicate.createdAt)}</span>
                    </span>
                    <Badge tone={TONES[duplicate.status]}>{duplicate.status.toLowerCase()}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* --------------------------------------------------- public preview */}
      <Card>
        <CardHeader
          title="How it would appear"
          description="The exact rendering the homepage uses, with the anonymity preference applied."
        />
        <CardBody>
          <figure className="rounded-card border border-line bg-surface-sunken p-5">
            <Quote aria-hidden className="size-5 text-brand" />
            <blockquote className="mt-3 whitespace-pre-line text-body">{submission.body}</blockquote>
            <figcaption className="mt-4 text-sm font-semibold text-ink">
              {submission.isAnonymous ? 'A worshipper' : submission.authorName}
              <span className="font-normal text-muted"> · {submission.country}</span>
            </figcaption>
          </figure>
        </CardBody>
      </Card>

      {/* --------------------------------------------------------- contact */}
      <Card>
        <CardHeader
          title="Contact details"
          description={
            showContact
              ? 'Visible to you because you may reply to submitters. Access is recorded.'
              : undefined
          }
        />
        <CardBody>
          {showContact ? (
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Email</dt>
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
            </dl>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Lock aria-hidden className="size-4" />
              Contact details are restricted to moderators who reply to submitters.
            </p>
          )}
        </CardBody>
      </Card>

      {/* ------------------------------------------------ flags and decide */}
      <Card>
        <CardHeader title="Moderation" />
        <CardBody className="space-y-5">
          <TestimonyControls
            id={submission.id}
            status={submission.status}
            isSpam={submission.isSpam}
            isTestData={submission.isTestData}
            featured={submission.featuredAt !== null}
            assignedToMe={submission.assignedTo?.id === user.id}
            assignedToName={submission.assignedTo?.username ?? null}
          />
          <ModerationActions id={submission.id} status={submission.status} />
        </CardBody>
      </Card>

      {/* --------------------------------------------------- note timeline */}
      <Card>
        <CardHeader
          title="Moderation notes"
          description="Internal only — never shown to the person who submitted it."
        />
        <CardBody className="space-y-4">
          <TestimonyNoteForm id={submission.id} />
          {submission.notes.length === 0 ? (
            <EmptyState
              title="No notes yet"
              description="Anything the team needs to remember about this testimony belongs here."
            />
          ) : (
            <ol className="space-y-3">
              {submission.notes.map((note) => (
                <li key={note.id} className="rounded-field bg-surface-sunken px-4 py-3">
                  <p className="text-sm text-body">{note.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {note.author?.username ?? 'Unknown'} · {formatDate(note.createdAt, true)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
