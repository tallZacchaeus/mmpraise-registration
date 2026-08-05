import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AnnouncementEditor } from '@/components/admin/announcements/announcement-editor'
import { AnnouncementLifecycle } from '@/components/admin/announcements/announcement-lifecycle'
import { Badge, buttonClass, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { announcementRecipients } from '@/lib/announcements/audience'
import { promoteDueAnnouncements } from '@/lib/announcements/lifecycle'
import { can, departmentScope, requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { getDepartments } from '@/lib/reference'
import { formatDate } from '@/lib/utils'
import type { AnnouncementStatus } from '@/generated/prisma/enums'

export const metadata: Metadata = { title: 'Announcement' }

const STATUS_TONES: Record<AnnouncementStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  PUBLISHED: 'success',
  EXPIRED: 'warning',
  ARCHIVED: 'neutral',
}

/** Date → `datetime-local` input value, in the server's timezone. */
function toLocalInputValue(date: Date | null): string | null {
  if (!date) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * One announcement: its content, its place in the lifecycle, exactly what a
 * volunteer will see, every email run, and every previous wording.
 */
export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission('announcement:manage')
  const scope = departmentScope(user)
  await promoteDueAnnouncements()

  const { id } = await params
  const announcement = await db.announcement.findUnique({
    where: { id },
    include: {
      department: { select: { name: true } },
      createdBy: { select: { username: true } },
      revisions: { orderBy: { version: 'desc' } },
      deliveries: { orderBy: { startedAt: 'desc' } },
    },
  })
  if (!announcement) notFound()
  if (scope !== null && (!announcement.departmentId || !scope.includes(announcement.departmentId))) {
    notFound()
  }

  // `editedById`/`updatedById` are plain columns (no relation), so the
  // usernames behind them are resolved in one lookup here.
  const editorIds = [
    ...new Set(
      [announcement.updatedById, ...announcement.revisions.map((r) => r.editedById)].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ]
  const [audience, departmentsAll, editors] = await Promise.all([
    announcementRecipients(announcement),
    getDepartments(),
    editorIds.length
      ? db.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, username: true } })
      : Promise.resolve([]),
  ])
  const editorName = (id: string | null) => editors.find((e) => e.id === id)?.username ?? null
  const updatedBy = editorName(announcement.updatedById)
  const departments =
    scope === null ? departmentsAll : departmentsAll.filter((d) => scope.includes(d.id))

  const audienceLabel =
    announcement.audience === 'DEPARTMENT'
      ? (announcement.department?.name ?? 'One department')
      : announcement.audience === 'APPROVED_ONLY'
        ? 'approved volunteers'
        : 'all volunteers'

  const canEmail = can(user, 'volunteer:message')
  const previewDate = announcement.publishedAt ?? new Date()

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/announcements"
          className={buttonClass({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft aria-hidden className="size-4" />
          All announcements
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-3xl">{announcement.title}</h1>
        <Badge tone={STATUS_TONES[announcement.status]}>{announcement.status.toLowerCase()}</Badge>
      </div>
      <p className="text-sm text-muted">
        Created {formatDate(announcement.createdAt, true)}
        {announcement.createdBy ? ` by ${announcement.createdBy.username}` : ''}
        {updatedBy ? ` · last edited by ${updatedBy}` : ''}
        {announcement.status === 'SCHEDULED' && announcement.scheduledFor
          ? ` · goes live ${formatDate(announcement.scheduledFor, true)}`
          : ''}
        {announcement.status === 'PUBLISHED' && announcement.publishedAt
          ? ` · live since ${formatDate(announcement.publishedAt, true)}`
          : ''}
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Lifecycle" />
            <CardBody>
              <AnnouncementLifecycle
                id={announcement.id}
                status={announcement.status}
                audienceLabel={audienceLabel}
                audienceCount={audience.length}
                canEmail={canEmail}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Content and audience" />
            <CardBody>
              <AnnouncementEditor
                announcement={{
                  id: announcement.id,
                  title: announcement.title,
                  body: announcement.body,
                  audience: announcement.audience,
                  departmentId: announcement.departmentId,
                  priority: announcement.priority,
                  showOnDashboard: announcement.showOnDashboard,
                  showAsBanner: announcement.showAsBanner,
                  emailSubject: announcement.emailSubject,
                  expiresAt: toLocalInputValue(announcement.expiresAt),
                }}
                departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                canEmail={canEmail}
                restrictedToDepartments={scope !== null}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="What a volunteer sees"
              description={
                announcement.showOnDashboard
                  ? undefined
                  : 'Currently hidden from dashboards — it would only go out by email.'
              }
            />
            <CardBody>
              <div
                className={
                  announcement.showAsBanner
                    ? 'rounded-field border-2 border-primary bg-primary-subtle px-4 py-3'
                    : undefined
                }
              >
                <p className="font-display font-bold uppercase text-ink">{announcement.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDate(previewDate)}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm text-body">{announcement.body}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Email runs"
              description="Every send is recorded — including tests, and who each failure was addressed to."
            />
            <CardBody>
              {announcement.deliveries.length === 0 ? (
                <p className="text-sm text-muted">Never emailed.</p>
              ) : (
                <ul className="space-y-3">
                  {announcement.deliveries.map((delivery) => (
                    <li key={delivery.id} className="rounded-field bg-surface-sunken px-4 py-3 text-sm">
                      <p className="flex flex-wrap items-center gap-2 text-body">
                        <span>{formatDate(delivery.startedAt, true)}</span>
                        {delivery.isTest && <Badge tone="neutral">Test</Badge>}
                        <Badge tone={delivery.failed > 0 ? 'danger' : 'success'}>
                          {delivery.succeeded}/{delivery.recipients} delivered
                        </Badge>
                      </p>
                      {delivery.failed > 0 && Array.isArray(delivery.failures) && (
                        <p className="mt-1 break-all text-xs text-muted">
                          Failed: {(delivery.failures as string[]).join(', ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Version history"
              description="What the announcement said before each edit."
            />
            <CardBody>
              {announcement.revisions.length === 0 ? (
                <p className="text-sm text-muted">Never edited.</p>
              ) : (
                <ol className="space-y-2">
                  {announcement.revisions.map((revision) => (
                    <li key={revision.id}>
                      <details className="rounded-field bg-surface-sunken px-4 py-3">
                        <summary className="cursor-pointer text-sm text-body">
                          <span className="font-semibold text-ink">Version {revision.version}</span>{' '}
                          · until {formatDate(revision.createdAt, true)}
                          {editorName(revision.editedById)
                            ? ` · replaced by ${editorName(revision.editedById)}`
                            : ''}
                        </summary>
                        <p className="mt-2 font-display text-sm font-bold uppercase text-ink">
                          {revision.title}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm text-body">{revision.body}</p>
                      </details>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
