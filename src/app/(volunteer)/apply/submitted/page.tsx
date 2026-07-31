import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Download, LayoutDashboard } from 'lucide-react'
import { Alert, Badge, buttonClass, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { requireUser } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { STATUS_LABELS, STATUS_TONES } from '@/lib/applications/status'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Registration submitted' }

export default async function SubmittedPage() {
  const user = await requireUser()

  const application = await db.volunteerApplication.findFirst({
    where: { userId: user.id, status: { not: 'DRAFT' } },
    orderBy: { submittedAt: 'desc' },
    include: { department: { select: { name: true } } },
  })

  if (!application) redirect('/apply')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardBody className="space-y-5 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-subtle">
            <CheckCircle2 aria-hidden className="size-8 text-success" />
          </span>

          <div>
            <h1 className="text-2xl sm:text-3xl">Registration submitted</h1>
            <p className="mt-2 text-body">
              Thank you, {user.firstName}. Your volunteer registration has been received and a
              confirmation email is on its way.
            </p>
          </div>

          <dl className="grid gap-4 rounded-card border border-line bg-surface-sunken p-5 text-left sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted">Registration ID</dt>
              <dd className="font-display text-lg font-bold text-ink">{application.registrationId}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Department</dt>
              <dd className="font-medium text-ink">{application.department?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Status</dt>
              <dd>
                <Badge tone={STATUS_TONES[application.status]}>{STATUS_LABELS[application.status]}</Badge>
              </dd>
            </div>
          </dl>

          <p className="text-sm text-muted">Submitted on {formatDate(application.submittedAt, true)}</p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/dashboard" className={buttonClass({ size: 'lg' })}>
              <LayoutDashboard aria-hidden className="size-4" />
              View your profile
            </Link>
            <Link
              href="/dashboard/summary"
              className={buttonClass({ variant: 'secondary', size: 'lg' })}
            >
              <Download aria-hidden className="size-4" />
              Download or print summary
            </Link>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What happens next" />
        <CardBody>
          <ol className="space-y-4">
            {[
              {
                title: 'We review your application',
                body: 'The registration team checks your details against your chosen department. This usually takes a few days.',
              },
              {
                title: 'You receive a decision by email',
                body: 'Your status will change to approved, waitlisted or not accepted. You can also check it any time on your dashboard.',
              },
              {
                title: 'Approved volunteers get shift details',
                body: 'We send briefing information, your shift assignments and what to bring on the day.',
              },
            ].map((item, index) => (
              <li key={item.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle font-display font-bold text-primary"
                >
                  {index + 1}
                </span>
                <span>
                  <span className="block font-display font-bold uppercase text-ink">{item.title}</span>
                  <span className="block text-sm text-body">{item.body}</span>
                </span>
              </li>
            ))}
          </ol>

          {!user.emailVerified && (
            <Alert tone="warning" title="One more thing" className="mt-5">
              Please confirm your email address so we can send you updates.{' '}
              <Link href="/verify-email" className="font-semibold underline underline-offset-4">
                Resend the confirmation link
              </Link>
              .
            </Alert>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
