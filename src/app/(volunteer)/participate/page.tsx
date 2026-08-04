import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ParticipateForm } from '@/components/volunteer/participate-form'
import { Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { eventConfig, eventStartsAt, formatEventDateLong } from '@/config/site'
import { requireUser } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { getOrCreateParticipation } from '@/lib/applications/service'
import { getDepartmentQuestions, getDepartmentsWithLoad } from '@/lib/reference'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Confirm your availability' }

/**
 * The returning volunteer's whole edition, on one page.
 *
 * A volunteer registers once. Each edition after that, this is everything they
 * are asked: which department, when they can serve, and this edition's
 * consents. One page, not a wizard — eight steps were for telling us who you
 * are, and we already know.
 */
export default async function ParticipatePage() {
  const user = await requireUser()

  const application = await db.volunteerApplication.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true },
  })

  // No registration, or an unfinished one → the full form, once.
  if (!application || application.status === 'DRAFT') redirect('/apply')

  const participation = await getOrCreateParticipation(application.id)

  /*
   * The default department is the one they served in most recently — this
   * edition's row if it already holds one, otherwise the newest earlier
   * participation. Returning is the common case, and the common case should be
   * "confirm what you did last time", not "choose from scratch".
   */
  let defaultDepartmentId = participation.departmentId
  if (!defaultDepartmentId) {
    const previous = await db.editionParticipation.findFirst({
      where: { applicationId: application.id, departmentId: { not: null } },
      orderBy: { edition: 'desc' },
      select: { departmentId: true },
    })
    defaultDepartmentId = previous?.departmentId ?? null
  }

  const [settings, departments, existingAvailability] = await Promise.all([
    getSettings(),
    getDepartmentsWithLoad(),
    db.volunteerAvailability.findMany({
      where: { participationId: participation.id },
      select: { date: true, period: true },
    }),
  ])

  // Server-render the default department's questions so the common case needs
  // no fetch; changing department loads the new set on demand.
  const initialQuestions = defaultDepartmentId
    ? await getDepartmentQuestions(defaultDepartmentId)
    : []

  const startsAt = eventStartsAt()
  const alreadyConfirmed = participation.confirmedAt !== null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-active underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to your dashboard
        </Link>
        <h1 className="mt-2 text-3xl">
          {alreadyConfirmed ? 'Update your availability' : `Serve at the ${eventConfig.edition} edition`}
        </h1>
        <p className="mt-1 max-w-2xl text-body">
          {alreadyConfirmed
            ? 'You are confirmed for this edition. You can change your department or dates here until the rota is set.'
            : `You are already registered — this is everything we need for ${
                startsAt ? formatEventDateLong(startsAt) : 'the next edition'
              }. It takes about two minutes.`}
        </p>
      </div>

      <Card>
        <CardHeader
          title={`The ${eventConfig.editionLabel}`}
          description="Your profile, emergency contact and approval carry over from your registration — nothing to re-enter."
        />
        <CardBody>
          <ParticipateForm
            departments={departments.map((d) => ({
              id: d.id,
              name: d.name,
              description: d.description,
              applied: d.applied,
            }))}
            initialQuestions={initialQuestions}
            eventDates={settings.event_dates}
            initialValues={{
              departmentId: defaultDepartmentId ?? '',
              availableDates: [
                ...new Set(existingAvailability.map((a) => a.date.toISOString().slice(0, 10))),
              ],
              preferredPeriods: [...new Set(existingAvailability.map((a) => a.period))],
              availableOvernight: participation.availableOvernight,
            }}
            alreadyConfirmed={alreadyConfirmed}
          />
        </CardBody>
      </Card>
    </div>
  )
}
