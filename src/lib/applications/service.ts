import 'server-only'
import { eventConfig } from '@/config/site'
import { db } from '@/lib/db'
import type { ApplicationStatus, Prisma } from '@/generated/prisma/client'
import type { AnswerMap, QuestionDef } from '@/lib/questions/engine'
import { pruneHiddenAnswers } from '@/lib/questions/engine'

export { STATUS_LABELS, STATUS_TONES, canVolunteerEdit } from './status'

/**
 * Application persistence.
 *
 * The wizard writes through two layers:
 *  - `draftData` holds whatever the volunteer has typed, saved continuously and
 *    without validation so nothing is lost on refresh or a dropped connection.
 *  - The normalised tables (profile, answers, availability…) are written when a
 *    step passes validation, which is what reporting and review read from.
 */

export type WizardState = Awaited<ReturnType<typeof loadWizardState>>

/**
 * The volunteer's application, created on first visit to the wizard.
 *
 * `findUnique` now, not `findFirst`: one application per person is a database
 * constraint rather than a convention, so there is no "most recent" to choose
 * between.
 */
export async function getOrCreateDraft(userId: string) {
  const existing = await db.volunteerApplication.findUnique({ where: { userId } })
  if (existing) return existing

  try {
    return await db.volunteerApplication.create({
      data: {
        userId,
        // Placeholder until submission assigns the real number from the
        // sequence. It uses the whole user id: a truncated id is not unique and
        // would stop a second volunteer starting their registration.
        registrationId: `DRAFT-${userId}`,
        status: 'DRAFT',
        currentStep: 1,
      },
    })
  } catch (error) {
    // Two requests can reach this point together (for example the wizard page
    // and its autosave). Whichever loses the race re-reads the winner's row.
    const created = await db.volunteerApplication.findUnique({ where: { userId } })
    if (created) return created
    throw error
  }
}

/**
 * The volunteer's record for one edition, created the first time they engage
 * with it.
 *
 * Upserted on `(applicationId, edition)`, which is unique — so a volunteer
 * confirming twice updates one row rather than accumulating two, and a returning
 * volunteer gets a fresh, empty record for the new edition without touching last
 * edition's answers.
 */
export async function getOrCreateParticipation(
  applicationId: string,
  edition: string = eventConfig.edition,
) {
  try {
    return await db.editionParticipation.upsert({
      where: { applicationId_edition: { applicationId, edition } },
      update: {},
      create: {
        applicationId,
        edition,
        year: Number(edition) || null,
      },
    })
  } catch {
    /*
     * The same race `getOrCreateDraft` documents: the wizard page and its
     * autosave can reach this together, and Prisma's upsert is not atomic here
     * — it emulates with a read then a write, so the loser trips the
     * `(applicationId, edition)` unique constraint instead of updating.
     * Whichever request loses re-reads the winner's row.
     */
    return db.editionParticipation.findUniqueOrThrow({
      where: { applicationId_edition: { applicationId, edition } },
    })
  }
}

export async function loadWizardState(userId: string) {
  const application = await getOrCreateDraft(userId)
  const participation = await getOrCreateParticipation(application.id)

  const [profile, answers, availability, emergency, health, user] = await Promise.all([
    db.volunteerProfile.findUnique({ where: { userId } }),
    db.applicationAnswer.findMany({
      where: { participationId: participation.id },
      include: { question: { select: { key: true } }, options: { include: { option: { select: { value: true } } } } },
    }),
    db.volunteerAvailability.findMany({ where: { participationId: participation.id } }),
    db.emergencyContact.findUnique({ where: { applicationId: application.id } }),
    db.applicationHealthInfo.findUnique({ where: { applicationId: application.id } }),
    db.user.findUnique({ where: { id: userId }, select: { email: true, username: true, mmpCode: true } }),
  ])

  const answerMap: AnswerMap = {}
  for (const answer of answers) {
    answerMap[answer.question.key] = {
      text: answer.valueText,
      number: answer.valueNumber ? Number(answer.valueNumber) : null,
      bool: answer.valueBool,
      date: answer.valueDate ? answer.valueDate.toISOString().slice(0, 10) : null,
      documentId: answer.documentId,
      options: answer.options.map((o) => ({ value: o.option.value, otherText: o.otherText })),
    }
  }

  return {
    application,
    participation,
    profile,
    user,
    answers: answerMap,
    availability,
    emergency,
    health,
    draft: (application.draftData as Record<string, unknown> | null) ?? {},
  }
}

/** Merge a partial step payload into the saved draft without validating it. */
export async function saveDraftData(applicationId: string, step: string, values: unknown) {
  const application = await db.volunteerApplication.findUnique({
    where: { id: applicationId },
    select: { draftData: true, status: true },
  })
  if (!application || application.status !== 'DRAFT') return

  const draft = ((application.draftData as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
  draft[step] = values

  await db.volunteerApplication.update({
    where: { id: applicationId },
    data: { draftData: draft as Prisma.InputJsonValue },
  })
}

/**
 * Replace the stored answers for a department's questions, for one edition.
 *
 * Scoped to the participation rather than the application: a volunteer who
 * serves in Media one edition and Medical the next has two different sets of
 * answers, and neither should overwrite the other.
 */
export async function persistAnswers(participationId: string, questions: QuestionDef[], answers: AnswerMap) {
  const cleaned = pruneHiddenAnswers(questions, answers)
  const byKey = new Map(questions.map((q) => [q.key, q]))

  await db.$transaction(async (tx) => {
    // Answers are replaced wholesale: it is the only way to guarantee that
    // answers to questions that became hidden do not linger.
    await tx.applicationAnswer.deleteMany({ where: { participationId } })

    for (const [key, value] of Object.entries(cleaned)) {
      const question = byKey.get(key)
      if (!question) continue

      const created = await tx.applicationAnswer.create({
        data: {
          participationId,
          questionId: question.id,
          valueText: value.text ?? null,
          valueNumber: value.number ?? null,
          valueBool: value.bool ?? null,
          valueDate: value.date ? new Date(value.date) : null,
          documentId: value.documentId ?? null,
        },
      })

      for (const choice of value.options ?? []) {
        const option = question.options.find((o) => o.value === choice.value)
        if (!option) continue
        await tx.applicationAnswerOption.create({
          data: {
            answerId: created.id,
            optionId: option.id,
            otherText: option.requiresText ? (choice.otherText ?? null) : null,
          },
        })
      }
    }
  })
}

/**
 * Allocate the next human-readable registration number.
 *
 * The year is the **edition's**, not today's. Using `new Date()` meant that
 * everyone registering during 2026 for the March 2027 marathon was issued an
 * `MMP-2026-…` identifier — a number that says the wrong event, on the badge
 * they turn up holding and in every report about it. Historical identifiers are
 * untouched: this only affects numbers issued from now on.
 */
export async function nextRegistrationId(): Promise<string> {
  const rows = await db.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('registration_id_seq')`
  const value = Number(rows[0]?.nextval ?? 1)
  return `MMP-${eventConfig.edition}-${String(value).padStart(6, '0')}`
}

/** Record a status transition and keep the application row in step. */
export async function transitionStatus(params: {
  applicationId: string
  to: ApplicationStatus
  actorId?: string | null
  reason?: string | null
}) {
  const application = await db.volunteerApplication.findUnique({
    where: { id: params.applicationId },
    select: { status: true },
  })
  if (!application) throw new Error('Application not found')

  await db.$transaction([
    db.volunteerApplication.update({
      where: { id: params.applicationId },
      data: {
        status: params.to,
        decisionReason: params.reason ?? null,
        reviewedById: params.actorId ?? null,
        reviewedAt: new Date(),
      },
    }),
    db.applicationStatusHistory.create({
      data: {
        applicationId: params.applicationId,
        fromStatus: application.status,
        toStatus: params.to,
        changedById: params.actorId ?? null,
        reason: params.reason ?? null,
      },
    }),
  ])
}
