import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CalendarClock,
  Download,
  Edit3,
  LifeBuoy,
  Megaphone,
  ShieldAlert,
  UserCog,
} from 'lucide-react'
import {
  Alert,
  Badge,
  buttonClass,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
} from '@/components/ui/primitives'
import { requireUser } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { canVolunteerEdit, STATUS_LABELS, STATUS_TONES } from '@/lib/applications/status'
import { getSettings } from '@/lib/settings'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Your dashboard' }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; denied?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams
  const settings = await getSettings()

  const application = await db.volunteerApplication.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      department: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 6 },
      assignments: {
        include: { shift: true },
        orderBy: { shift: { startsAt: 'asc' } },
      },
    },
  })

  const announcements = await db.announcement.findMany({
    where: {
      publishedAt: { not: null, lte: new Date() },
      OR: [
        { audience: 'ALL_VOLUNTEERS' },
        ...(application?.departmentId
          ? [{ audience: 'DEPARTMENT' as const, departmentId: application.departmentId }]
          : []),
        ...(application?.status === 'APPROVED' || application?.status === 'ASSIGNED'
          ? [{ audience: 'APPROVED_ONLY' as const }]
          : []),
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 5,
  })

  const isDraft = !application || application.status === 'DRAFT'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Welcome, {user.firstName ?? user.username}</h1>
          <p className="mt-1 text-body">Your volunteer registration and updates for {settings.event_name}.</p>
        </div>
        {!isDraft && (
          <Link href="/dashboard/summary" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            <Download aria-hidden className="size-4" />
            Registration summary
          </Link>
        )}
      </div>

      {params.saved === '1' && (
        <Alert tone="success" title="Progress saved">
          Your draft is saved. Continue whenever you are ready — nothing is lost.
        </Alert>
      )}
      {params.denied === '1' && (
        <Alert tone="danger" title="You do not have access to that page" icon={<ShieldAlert className="size-5" />}>
          If you think this is wrong, contact the volunteer team.
        </Alert>
      )}
      {!user.emailVerified && (
        <Alert tone="warning" title="Confirm your email address">
          We sent a confirmation link to {user.email}.{' '}
          <Link href="/verify-email" className="font-semibold underline underline-offset-4">
            Resend it
          </Link>
          .
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Your application"
              action={
                application && (
                  <Badge tone={STATUS_TONES[application.status]}>{STATUS_LABELS[application.status]}</Badge>
                )
              }
            />
            <CardBody className="space-y-5">
              {isDraft ? (
                <>
                  <p className="text-body">
                    {application
                      ? 'Your registration is still a draft. Pick up where you left off — everything you entered is saved.'
                      : 'You have not started your registration yet.'}
                  </p>
                  <Link href="/apply" className={buttonClass({ size: 'lg' })}>
                    {application ? 'Continue registration' : 'Start registration'}
                  </Link>
                </>
              ) : (
                <>
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm text-muted">Registration ID</dt>
                      <dd className="font-display text-lg font-bold text-ink">{application!.registrationId}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted">Department</dt>
                      <dd className="font-medium text-ink">{application!.department?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted">Submitted</dt>
                      <dd className="font-medium text-ink">{formatDate(application!.submittedAt)}</dd>
                    </div>
                  </dl>

                  {application!.decisionReason && (
                    <Alert tone={application!.status === 'REJECTED' ? 'danger' : 'info'} title="Message from the review team">
                      {application!.decisionReason}
                    </Alert>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {canVolunteerEdit(application!.status) ? (
                      <Link href="/apply/personal" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                        <Edit3 aria-hidden className="size-4" />
                        Edit your details
                      </Link>
                    ) : (
                      <p className="text-sm text-muted">
                        Your application is locked now that it has been reviewed. Contact the volunteer
                        team if something needs to change.
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Your shifts" />
            <CardBody>
              {application?.assignments.length ? (
                <ul className="divide-y divide-line">
                  {application.assignments.map((assignment) => (
                    <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-display font-bold uppercase text-ink">{assignment.shift.name}</p>
                        <p className="text-sm text-muted">
                          {formatDate(assignment.shift.startsAt, true)} — {formatDate(assignment.shift.endsAt, true)}
                          {assignment.shift.location ? ` · ${assignment.shift.location}` : ''}
                        </p>
                      </div>
                      <Badge tone="info">{assignment.shift.period.toLowerCase()}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<CalendarClock className="size-8" />}
                  title="No shifts assigned yet"
                  description="Once your application is approved, your shifts will appear here."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Announcements" />
            <CardBody>
              {announcements.length ? (
                <ul className="space-y-4">
                  {announcements.map((announcement) => (
                    <li key={announcement.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                      <p className="font-display font-bold uppercase text-ink">{announcement.title}</p>
                      <p className="text-xs text-muted">{formatDate(announcement.publishedAt)}</p>
                      <p className="mt-1.5 whitespace-pre-line text-sm text-body">{announcement.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<Megaphone className="size-8" />}
                  title="No announcements yet"
                  description="Updates from the volunteer team will appear here."
                />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Quick actions" />
            <CardBody className="space-y-2">
              <Link
                href="/dashboard/account"
                className="flex min-h-11 items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold text-body hover:bg-surface-sunken"
              >
                <UserCog aria-hidden className="size-4 text-primary" />
                Account and password
              </Link>
              {!isDraft && (
                <Link
                  href="/dashboard/summary"
                  className="flex min-h-11 items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold text-body hover:bg-surface-sunken"
                >
                  <Download aria-hidden className="size-4 text-primary" />
                  Download registration summary
                </Link>
              )}
              <a
                href={`mailto:${settings.support_email}?subject=${encodeURIComponent(
                  application?.registrationId ? `Volunteer support — ${application.registrationId}` : 'Volunteer support',
                )}`}
                className="flex min-h-11 items-center gap-3 rounded-field px-3 py-2 text-sm font-semibold text-body hover:bg-surface-sunken"
              >
                <LifeBuoy aria-hidden className="size-4 text-primary" />
                Contact volunteer support
              </a>
            </CardBody>
          </Card>

          {application && application.statusHistory.length > 0 && (
            <Card>
              <CardHeader title="Status history" />
              <CardBody>
                <ol className="space-y-3">
                  {application.statusHistory.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3">
                      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      <span>
                        <span className="block text-sm font-semibold text-ink">
                          {STATUS_LABELS[entry.toStatus]}
                        </span>
                        <span className="block text-xs text-muted">{formatDate(entry.createdAt, true)}</span>
                        {entry.reason && <span className="mt-1 block text-sm text-body">{entry.reason}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
