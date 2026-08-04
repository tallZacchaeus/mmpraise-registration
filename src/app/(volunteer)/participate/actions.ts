'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eventConfig } from '@/config/site'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { requireUser } from '@/lib/auth/rbac'
import { fail, ok, parseOrFail, type ActionResult } from '@/lib/actions/result'
import { getOrCreateParticipation, persistAnswers } from '@/lib/applications/service'
import { getDepartmentQuestions } from '@/lib/reference'
import { validateAnswers, type AnswerMap } from '@/lib/questions/engine'
import { getSettings } from '@/lib/settings'

/**
 * Confirming availability for one edition — the returning volunteer's whole
 * journey.
 *
 * A volunteer registers once; this is everything they decide *again* each
 * edition, in a single submission: which department, when they can serve, and
 * this edition's consents. Nothing here touches the profile, the motivation or
 * the approval — those were settled at registration and stay settled.
 */

const confirmSchema = z.object({
  departmentId: z.string().min(1, 'Choose the department you want to serve in'),
  availableDates: z.array(z.string()).min(1, 'Select at least one date you can serve'),
  preferredPeriods: z
    .array(z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'OVERNIGHT']))
    .min(1, 'Select at least one shift period'),
  availableOvernight: z.boolean({ message: 'Tell us whether you can serve overnight' }),
  /*
   * Consents are literal(true), not boolean: an unticked consent is not a
   * value to store, it is a submission that cannot proceed. They are re-taken
   * every edition — agreement to the 2027 terms is not agreement to 2029's.
   */
  consentAccurate: z.literal(true, { message: 'Confirm your information is accurate' }),
  consentTerms: z.literal(true, { message: 'Accept the volunteer terms for this edition' }),
  consentDataProcessing: z.literal(true, { message: 'Consent to data processing is required' }),
  consentCommunication: z.literal(true, { message: 'Consent to be contacted about your service' }),
})

export type ConfirmParticipationInput = z.input<typeof confirmSchema>

export async function confirmParticipationAction(
  values: unknown,
  answers: AnswerMap,
): Promise<ActionResult<{ edition: string }>> {
  const user = await requireUser()

  const settings = await getSettings()
  if (!settings.registration_open) {
    return fail(settings.registration_closed_message, undefined, 'registration_closed')
  }

  /*
   * Only somebody who has registered can confirm. A visitor without an
   * application — or with an unfinished one — is sent through registration
   * instead; this route never becomes a shortcut around it.
   */
  const application = await db.volunteerApplication.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true },
  })
  if (!application || application.status === 'DRAFT') {
    return fail('Complete your registration first', undefined, 'not_registered')
  }

  const parsed = parseOrFail(confirmSchema, values)
  if (!parsed.ok) return parsed.result
  const data = parsed.data

  const department = await db.department.findFirst({
    where: { id: data.departmentId, isActive: true },
    select: { id: true, name: true },
  })
  if (!department) {
    return fail('Choose a valid department', { departmentId: 'Choose a valid department' })
  }

  const questions = await getDepartmentQuestions(department.id)
  const answerErrors = validateAnswers(questions, answers)
  if (Object.keys(answerErrors).length > 0) {
    const fieldErrors: Record<string, string> = {}
    for (const [key, message] of Object.entries(answerErrors)) {
      fieldErrors[`answers.${key}`] = message
    }
    return fail('Please answer the department questions', fieldErrors)
  }

  // Same date policy as first registration: when the organisation has
  // published dates, only those count.
  const allowedDates = new Set(settings.event_dates)
  const dates = data.availableDates.filter((d) => allowedDates.size === 0 || allowedDates.has(d))
  if (dates.length === 0) {
    return fail('Select at least one valid date', {
      availableDates: 'Select at least one date you can serve',
    })
  }

  const participation = await getOrCreateParticipation(application.id)

  await db.$transaction(async (tx) => {
    await tx.editionParticipation.update({
      where: { id: participation.id },
      data: {
        departmentId: department.id,
        availableOvernight: data.availableOvernight,
        consentAccurate: true,
        consentTerms: true,
        consentDataProcessing: true,
        consentCommunication: true,
        consentedAt: new Date(),
        confirmedAt: new Date(),
        // A volunteer who withdrew and comes back is simply signed up again.
        status: 'SIGNED_UP',
        withdrawnAt: null,
      },
    })

    await tx.volunteerAvailability.deleteMany({ where: { participationId: participation.id } })
    for (const date of dates) {
      for (const period of data.preferredPeriods) {
        await tx.volunteerAvailability.create({
          data: {
            participationId: participation.id,
            date: new Date(`${date}T00:00:00.000Z`),
            period,
          },
        })
      }
    }
  })

  await persistAnswers(participation.id, questions, answers)

  await audit({
    action: 'application.updated',
    entityType: 'EditionParticipation',
    entityId: participation.id,
    actorId: user.id,
    metadata: {
      event: 'participation_confirmed',
      edition: participation.edition,
      departmentId: department.id,
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/participate')

  return ok({ edition: eventConfig.edition })
}
