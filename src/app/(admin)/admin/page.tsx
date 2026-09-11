import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Inbox,
  MapPin,
  Megaphone,
  UploadCloud,
  UserPlus,
  Users,
} from 'lucide-react'
import { AdminCountdown } from '@/components/admin/admin-countdown'
import { Badge, Card, CardBody, CardHeader, buttonClass } from '@/components/ui/primitives'
import { eventConfig, eventEndsAt, eventStartsAt, formatEventDateTime } from '@/config/site'
import { can, requirePermission } from '@/lib/auth/rbac'
import { ACTIVITY_LABELS, getOverview } from '@/lib/admin/overview'
import { AGE_RANGES } from '@/lib/validation/registration'
import { cn, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Administration overview' }

/**
 * The operational command centre.
 *
 * Ordered by the question it answers, top to bottom: *is anything on fire?* →
 * *where does the event stand?* → *how is the volunteer base moving?* → detail.
 * The old overview reported four totals and left the reader to infer the work;
 * here every actionable number is a link to the filtered view that resolves it.
 *
 * Bars stay plain divs sized by percentage — no chart library, so the page is
 * fast and every figure is readable to a screen reader.
 */
export default async function AdminOverviewPage() {
  const user = await requirePermission('application:review')
  const overview = await getOverview(user)

  const startsAt = eventStartsAt()
  const endsAt = eventEndsAt()

  const maxDepartment = Math.max(1, ...overview.distributions.byDepartment.map((d) => d.count))
  const maxCountry = Math.max(1, ...overview.distributions.byCountry.map((c) => c.count))
  const maxTrend = Math.max(1, ...overview.trend.map((t) => t.count))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Overview</h1>
          <p className="mt-1 text-body">The operational state of the {eventConfig.editionLabel}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, 'migration:create') && (
            <Link
              href="/admin/previous-participants/new"
              className={buttonClass({ variant: 'outline', size: 'sm' })}
            >
              <UploadCloud aria-hidden className="size-4" />
              New import
            </Link>
          )}
          {can(user, 'announcement:manage') && (
            <Link href="/admin/announcements" className={buttonClass({ variant: 'outline', size: 'sm' })}>
              <Megaphone aria-hidden className="size-4" />
              Announce
            </Link>
          )}
        </div>
      </div>

      {/* ------------------------------------------------- needs attention */}
      <Card>
        <CardHeader
          title="Needs attention"
          description={
            overview.needsAttention.length === 0
              ? undefined
              : 'Most urgent first. Each line opens the queue it counts.'
          }
        />
        <CardBody>
          {overview.needsAttention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-body">
              <CheckCircle2 aria-hidden className="size-5 text-success" />
              Nothing is waiting on you. Every queue is clear.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {overview.needsAttention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center justify-between gap-4 py-2.5 hover:bg-surface-sunken"
                  >
                    <span className="flex items-center gap-3 text-sm font-medium text-ink">
                      <AlertTriangle
                        aria-hidden
                        className={`size-4 shrink-0 ${
                          item.tone === 'danger'
                            ? 'text-danger'
                            : item.tone === 'warning'
                              ? 'text-warning'
                              : 'text-info'
                        }`}
                      />
                      <span>
                        <span className="font-display text-lg font-bold tabular-nums">
                          {item.count}
                        </span>{' '}
                        {item.label}
                      </span>
                    </span>
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ----------------------------------------------------- event status */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="font-display text-sm font-bold uppercase tracking-wide text-primary-active">
              {eventConfig.editionName} {eventConfig.edition}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-body">
              <CalendarClock aria-hidden className="size-4 shrink-0 text-muted" />
              {startsAt ? formatEventDateTime(startsAt) : 'Date to be announced'}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {eventConfig.venue.fullAddress}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <AdminCountdown
              startsAtIso={startsAt?.toISOString() ?? null}
              endsAtIso={endsAt?.toISOString() ?? null}
            />
            <Badge tone={overview.event.registrationOpen ? 'success' : 'danger'}>
              Registration {overview.event.registrationOpen ? 'open' : 'closed'}
            </Badge>
          </div>
        </CardBody>
      </Card>

      {/* ------------------------------------------- the two lifecycles */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Registrations"
            description="One-time standing: a person applies once and is approved once."
          />
          <CardBody>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Total" value={overview.applications.total} href="/admin/applications" />
              <Metric
                label="Awaiting review"
                value={overview.applications.awaitingReview}
                href="/admin/applications?status=SUBMITTED"
                tone={overview.applications.awaitingReview > 0 ? 'warning' : undefined}
              />
              <Metric
                label="Approved"
                value={overview.applications.approved}
                href="/admin/applications?status=APPROVED"
                tone="success"
              />
              <Metric label="Draft" value={overview.applications.draft} />
              <Metric
                label="Waitlisted"
                value={overview.applications.waitlisted}
                href="/admin/applications?status=WAITLISTED"
              />
              <Metric
                label="Not accepted"
                value={overview.applications.rejected}
                href="/admin/applications?status=REJECTED"
              />
            </ul>
            <p className="mt-4 text-xs text-muted">
              {overview.applications.submittedThisWeek} submitted in the last seven days.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={`${eventConfig.edition} participation`}
            description="This edition: who has confirmed they are coming, and where they stand."
          />
          <CardBody>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Confirmed" value={overview.participations.confirmed} tone="success" />
              <Metric
                label="Not yet confirmed"
                value={overview.participations.unconfirmed}
                tone={overview.participations.unconfirmed > 0 ? 'warning' : undefined}
              />
              <Metric label="Assigned to shifts" value={overview.participations.assigned} />
              <Metric label="Checked in" value={overview.participations.checkedIn} />
              <Metric label="Completed" value={overview.participations.completed} />
              <Metric label="Withdrawn" value={overview.participations.withdrawn} />
            </ul>
            <p className="mt-4 text-xs text-muted">
              “Not yet confirmed” counts registered volunteers with no confirmed availability for
              this edition — the number the invitation campaign exists to drive down.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------- migration and comms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {overview.migration && (
          <Card>
            <CardHeader
              title="Previous participants"
              description="The legacy import and its activation."
              action={
                <Link
                  href="/admin/previous-participants"
                  className={buttonClass({ variant: 'ghost', size: 'sm' })}
                >
                  Open
                </Link>
              }
            />
            <CardBody>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Metric
                  label="Imported"
                  value={overview.migration.imported}
                  href="/admin/previous-participants"
                />
                <Metric label="Invited" value={overview.migration.invitesSent} />
                <Metric label="Activated" value={overview.migration.activated} tone="success" />
                <Metric label="Profiles reviewed" value={overview.migration.reviewed} />
                <Metric
                  label="Failed invites"
                  value={overview.migration.invitesFailed}
                  tone={overview.migration.invitesFailed > 0 ? 'danger' : undefined}
                />
                <Metric
                  label="Failed rows"
                  value={overview.migration.failedRows}
                  tone={overview.migration.failedRows > 0 ? 'danger' : undefined}
                />
              </ul>
              {overview.migration.runningBatches > 0 && (
                <p className="mt-4 text-xs text-muted" aria-live="polite">
                  {overview.migration.runningBatches}{' '}
                  {overview.migration.runningBatches === 1 ? 'import is' : 'imports are'} running now.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {overview.comms && (
          <Card>
            <CardHeader
              title="Communications"
              description="What the public has sent, and what left here."
            />
            <CardBody>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Metric
                  label="New messages"
                  value={overview.comms.newMessages}
                  href="/admin/messages"
                  tone={overview.comms.newMessages > 0 ? 'warning' : undefined}
                />
                <Metric
                  label="Pending testimonies"
                  value={overview.comms.pendingTestimonies}
                  href="/admin/testimonies"
                  tone={overview.comms.pendingTestimonies > 0 ? 'warning' : undefined}
                />
                <Metric
                  label="Failed emails"
                  value={overview.comms.failedEmails}
                  tone={overview.comms.failedEmails > 0 ? 'danger' : undefined}
                />
              </ul>
            </CardBody>
          </Card>
        )}
      </div>

      {/* ----------------------------------------------------- analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Submissions, last eight weeks"
            description="New registrations submitted per week."
          />
          <CardBody>
            {overview.trend.length === 0 ? (
              <p className="text-sm text-muted">No submissions in the last eight weeks.</p>
            ) : (
              <ol className="flex h-32 items-end gap-2" aria-hidden>
                {overview.trend.map((point) => (
                  <li key={point.week.toISOString()} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs tabular-nums text-muted">{point.count}</span>
                    <span
                      className="w-full rounded-t bg-primary"
                      style={{
                        height: `${Math.max(6, Math.round((point.count / maxTrend) * 100))}%`,
                      }}
                    />
                    <span className="text-[0.625rem] text-muted">
                      {formatDate(point.week).slice(0, 6)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {/* The numbers, readable without the bars. */}
            <p className="sr-only">
              Weekly submissions:{' '}
              {overview.trend.map((point) => `${formatDate(point.week)}: ${point.count}`).join('; ')}.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="By department"
            description={`Where confirmed ${eventConfig.edition} volunteers are serving. Distribution only — departments have no cap.`}
          />
          <CardBody>
            {overview.distributions.byDepartment.length === 0 ? (
              <p className="text-sm text-muted">Nobody has confirmed a department yet.</p>
            ) : (
              <ul className="space-y-3">
                {overview.distributions.byDepartment.map((row) => (
                  <DistributionRow
                    key={row.id ?? row.name}
                    label={row.name}
                    count={row.count}
                    max={maxDepartment}
                    href={row.id ? `/admin/applications?departmentId=${row.id}` : null}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top countries" />
          <CardBody>
            <ul className="space-y-3">
              {overview.distributions.byCountry.length === 0 && (
                <li className="text-sm text-muted">No applications yet.</li>
              )}
              {overview.distributions.byCountry.map((row) => (
                <DistributionRow
                  key={row.id ?? row.name}
                  label={row.name}
                  count={row.count}
                  max={maxCountry}
                  tone="brand"
                  href={row.id ? `/admin/applications?countryId=${row.id}` : null}
                />
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By age range" />
          <CardBody>
            <ul className="grid gap-2 sm:grid-cols-2">
              {overview.distributions.byAgeRange.length === 0 && (
                <li className="text-sm text-muted">No applications yet.</li>
              )}
              {overview.distributions.byAgeRange.map((row) => {
                const label = AGE_RANGES.find((a) => a.value === row.ageRange)?.label ?? 'Not given'
                const inner = (
                  <>
                    <span className="text-body group-hover:underline">{label}</span>
                    <span className="font-semibold tabular-nums text-ink">{row.count}</span>
                  </>
                )
                return (
                  <li key={row.ageRange ?? 'unknown'}>
                    {row.ageRange ? (
                      <Link
                        href={`/admin/applications?ageRange=${row.ageRange}`}
                        aria-label={`${label}: ${row.count}. View these volunteers.`}
                        className="group flex items-center justify-between gap-3 rounded-field text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-3 text-sm">{inner}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------ recent activity */}
      {overview.recentActivity.length > 0 && (
        <Card>
          <CardHeader
            title="Recent activity"
            description="The last few recorded actions, newest first."
            action={
              <Link href="/admin/audit" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
                Activity log
              </Link>
            }
          />
          <CardBody>
            <ul className="divide-y divide-line">
              {overview.recentActivity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
                >
                  <span className="text-body">
                    {ACTIVITY_LABELS[entry.action] ?? entry.action}
                    {entry.actor && <span className="text-muted"> — {entry.actor.username}</span>}
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {formatDate(entry.createdAt, true)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* -------------------------------------------------- quick actions */}
      <Card>
        <CardHeader title="Quick actions" />
        <CardBody className="flex flex-wrap gap-3">
          <Link href="/admin/applications" className={buttonClass({ variant: 'outline', size: 'sm' })}>
            <Users aria-hidden className="size-4" />
            Review applications
          </Link>
          {can(user, 'migration:view') && (
            <Link
              href="/admin/previous-participants"
              className={buttonClass({ variant: 'outline', size: 'sm' })}
            >
              <UserPlus aria-hidden className="size-4" />
              Previous participants
            </Link>
          )}
          <Link href="/admin/messages" className={buttonClass({ variant: 'outline', size: 'sm' })}>
            <Inbox aria-hidden className="size-4" />
            Messages
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}

/** One figure. A link when there is a view that resolves it. */
function Metric({
  label,
  value,
  href,
  tone,
}: {
  label: string
  value: number
  href?: string
  tone?: 'success' | 'warning' | 'danger'
}) {
  const colour =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-ink'

  const body = (
    <>
      <span className="block text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className={`mt-0.5 block font-display text-2xl font-bold tabular-nums ${colour}`}>
        {value}
      </span>
    </>
  )

  return (
    <li>
      {href ? (
        <Link href={href} className="-m-1 block rounded-field p-1 hover:bg-surface-sunken">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  )
}

/**
 * One row of a distribution: a label, a count, and a bar.
 *
 * The bar is decorative, so the link's accessible name carries the figure and
 * says what following it does. When a segment cannot be expressed as a filter
 * — "No department yet", an unknown country — it stays plain text rather than
 * offering a link that would filter on nothing.
 */
function DistributionRow({
  label,
  count,
  max,
  href,
  tone = 'primary',
}: {
  label: string
  count: number
  max: number
  href: string | null
  tone?: 'primary' | 'brand'
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium text-ink group-hover:underline">{label}</span>
        <span className="tabular-nums text-muted">{count}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-pill bg-line" role="presentation">
        <div
          className={cn('h-full rounded-pill', tone === 'brand' ? 'bg-brand' : 'bg-primary')}
          style={{ width: `${Math.round((count / max) * 100)}%` }}
        />
      </div>
    </>
  )

  return (
    <li>
      {href ? (
        <Link
          href={href}
          aria-label={`${label}: ${count}. View these volunteers.`}
          className="group block rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  )
}
