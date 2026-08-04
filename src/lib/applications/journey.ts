import type { ApplicationStatus } from '@/generated/prisma/enums'

/**
 * The volunteer's journey, as nine named stages.
 *
 * The nine values of `ApplicationStatus` are the right vocabulary for the
 * database and for administrators, but they are a poor way to answer the
 * question a volunteer actually arrives with: *where am I, and what happens
 * next?* The stages below are that answer — they run from creating an account
 * to standing ready on the day, and they only ever move forwards.
 *
 * Two stages are deliberately not driven by `status` alone:
 *
 *  - **Department confirmed** needs a department on the record, because a
 *    volunteer can be approved before one is attached.
 *  - **Accommodation** has no data behind it at all. The platform stores no
 *    accommodation record, so the stage reports honestly that arrangements are
 *    published separately rather than inventing a state. See the final report.
 *
 * Deliberately free of `server-only` imports — the timeline is rendered by a
 * Client Component so it can animate.
 */

export type MilestoneState =
  /** Reached and passed. */
  | 'complete'
  /** Where the volunteer is now. */
  | 'current'
  /** Ahead of them. */
  | 'upcoming'
  /** Will not be reached on this application. */
  | 'stopped'
  /** No data exists to decide either way; the stage says so plainly. */
  | 'unknown'

export type MilestoneId =
  | 'account'
  | 'registration'
  | 'submitted'
  | 'review'
  | 'approved'
  | 'department'
  | 'accommodation'
  | 'shifts'
  | 'ready'

export type JourneyMilestone = {
  id: MilestoneId
  title: string
  /** Worded for the state the stage is actually in. */
  description: string
  state: MilestoneState
}

/**
 * Where the volunteer stands overall — used to choose the dashboard's tone, its
 * primary action and which cards are worth showing.
 *
 * The three event-driven phases (`event_week`, `live`, `finished`) are only
 * reachable once an application has been accepted: someone whose application is
 * still a draft on the morning of the marathon needs to be told to finish it,
 * not congratulated on the event starting.
 */
export type LifecyclePhase =
  | 'not_started'
  | 'in_progress'
  | 'awaiting_review'
  | 'approved'
  | 'waitlisted'
  | 'not_accepted'
  | 'event_week'
  | 'live'
  | 'finished'

/** Statuses that mean "we have it, and nobody has decided yet". */
const WAITING: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW']

/** Statuses that mean the volunteer is on the team. */
const ACCEPTED: ApplicationStatus[] = ['APPROVED', 'ASSIGNED', 'CHECKED_IN', 'COMPLETED']

/** Statuses that mean a reviewer has reached a verdict, whatever it was. */
const DECIDED: ApplicationStatus[] = [
  'APPROVED',
  'WAITLISTED',
  'REJECTED',
  'ASSIGNED',
  'CHECKED_IN',
  'COMPLETED',
]

export function isAccepted(status: ApplicationStatus | null): boolean {
  return status !== null && ACCEPTED.includes(status)
}

/**
 * Resolve the lifecycle phase.
 *
 * `eventState` and `daysUntilEvent` are passed in rather than read from the
 * clock here, so this stays a pure function that a test can drive to any point
 * in the event's life.
 */
export function lifecyclePhase({
  status,
  eventState,
  daysUntilEvent,
}: {
  status: ApplicationStatus | null
  eventState: 'unscheduled' | 'upcoming' | 'live' | 'completed'
  /** Whole days from now to the first hour of praise. Null when unscheduled. */
  daysUntilEvent: number | null
}): LifecyclePhase {
  if (status === 'COMPLETED' || (isAccepted(status) && eventState === 'completed')) {
    return 'finished'
  }
  if (isAccepted(status) && eventState === 'live') return 'live'
  if (
    isAccepted(status) &&
    eventState === 'upcoming' &&
    daysUntilEvent !== null &&
    daysUntilEvent <= 7
  ) {
    return 'event_week'
  }

  if (status === null || status === 'DRAFT') {
    return status === null ? 'not_started' : 'in_progress'
  }
  if (WAITING.includes(status)) return 'awaiting_review'
  if (status === 'WAITLISTED') return 'waitlisted'
  if (status === 'REJECTED') return 'not_accepted'
  return 'approved'
}

export type JourneyInput = {
  status: ApplicationStatus | null
  /** Wizard steps genuinely saved, out of `totalSteps`. */
  completedSteps?: number
  totalSteps?: number
  /** The department on the record, once one has been chosen. */
  departmentName?: string | null
  /** How many shifts have been assigned. */
  shiftCount?: number
  /** True once the volunteer has confirmed their email address. */
  emailVerified?: boolean
  /**
   * Whether the organisation publishes accommodation through this platform.
   * False today — nothing stores it — which is what the stage reports.
   */
  accommodationPublished?: boolean
}

/**
 * Build the nine stages for a given application.
 *
 * Every stage's state is derived from data the platform actually holds. Where
 * it holds none — accommodation — the stage says so instead of guessing.
 */
export function buildJourney({
  status,
  completedSteps = 0,
  totalSteps = 8,
  departmentName = null,
  shiftCount = 0,
  emailVerified = true,
  accommodationPublished = false,
}: JourneyInput): JourneyMilestone[] {
  const started = status !== null
  const submitted = started && status !== 'DRAFT'
  const decided = status !== null && DECIDED.includes(status)
  const accepted = isAccepted(status)
  const rejected = status === 'REJECTED'
  const waitlisted = status === 'WAITLISTED'
  const reviewed = decided || status === 'UNDER_REVIEW'
  const ready = status === 'CHECKED_IN' || status === 'COMPLETED'
  // Checking in is proof a rota exists, whatever the assignment rows say.
  const hasShifts = shiftCount > 0 || ready

  /** After a rejection nothing downstream will happen; say so once, not five times. */
  const afterDecision = (state: MilestoneState): MilestoneState => (rejected ? 'stopped' : state)

  return [
    {
      id: 'account',
      title: 'Account created',
      description: emailVerified
        ? 'Your account is active and your email address is confirmed.'
        : 'Your account is active. Confirm your email address so we can reach you about your application.',
      state: 'complete',
    },
    {
      id: 'registration',
      title: 'Registration in progress',
      description: !started
        ? 'Begin your volunteer registration. It saves as you go, so you can stop and return.'
        : submitted
          ? 'You completed every section of the registration form.'
          : completedSteps === 0
            ? 'Your registration is open and waiting. Nothing has been entered yet.'
            : `${completedSteps} of ${totalSteps} sections finished. Everything you have entered is saved.`,
      state: submitted ? 'complete' : 'current',
    },
    {
      id: 'submitted',
      title: 'Application submitted',
      description: submitted
        ? 'We have your application, along with the department you asked to serve in.'
        : 'Once every section is complete you can review your answers and submit.',
      state: submitted ? 'complete' : 'upcoming',
    },
    {
      id: 'review',
      title: 'Under review',
      description: reviewed
        ? 'Your department has read your application.'
        : submitted
          ? 'Your department is reading your application. You will hear by email.'
          : 'Your chosen department reviews every application individually.',
      state: decided ? 'complete' : submitted ? 'current' : 'upcoming',
    },
    {
      id: 'approved',
      title: 'Approved',
      description: rejected
        ? 'Your application was not accepted for this edition. You are welcome to apply again.'
        : waitlisted
          ? 'You are on the waiting list. If a place opens in your department, we will contact you.'
          : accepted
            ? 'You have been approved to serve.'
            : 'You will be told the outcome by email, and it will appear here too.',
      state: rejected
        ? 'stopped'
        : waitlisted
          ? 'current'
          : accepted
            ? 'complete'
            : 'upcoming',
    },
    {
      id: 'department',
      title: 'Department confirmed',
      description: departmentName
        ? accepted
          ? `You are serving with ${departmentName}.`
          : `You asked to serve with ${departmentName}. It is confirmed once your application is approved.`
        : 'You choose a department during registration, and it is confirmed when you are approved.',
      state: afterDecision(accepted && departmentName ? 'complete' : 'upcoming'),
    },
    {
      id: 'accommodation',
      title: 'Accommodation',
      description: accommodationPublished
        ? 'Your accommodation details are published below.'
        : 'Accommodation is arranged by the volunteer team and is not published through this dashboard yet. Contact the team if you need somewhere to stay.',
      // Not "upcoming" — that would promise something this platform does not
      // yet track. `unknown` renders as an outlined marker and a plain note.
      state: rejected ? 'stopped' : accommodationPublished ? 'complete' : 'unknown',
    },
    {
      id: 'shifts',
      title: 'Shifts assigned',
      description: hasShifts
        ? `${shiftCount} ${shiftCount === 1 ? 'shift' : 'shifts'} assigned. They are listed further down this page.`
        : accepted
          ? 'Your department is still building the rota. Your shifts will appear on this page.'
          : 'Approved volunteers are given shifts and a team to serve with.',
      state: afterDecision(hasShifts ? 'complete' : accepted ? 'current' : 'upcoming'),
    },
    {
      id: 'ready',
      title: 'Ready to serve',
      description:
        status === 'COMPLETED'
          ? 'You served. Thank you for giving your time to the marathon.'
          : status === 'CHECKED_IN'
            ? 'You are checked in. Your team lead will take it from here.'
            : hasShifts
              ? 'Everything is in place. Arrive for your first shift and check in with your team lead.'
              : 'Once your shifts are set you are ready for the marathon.',
      state: afterDecision(
        status === 'COMPLETED' ? 'complete' : ready ? 'current' : hasShifts ? 'current' : 'upcoming',
      ),
    },
  ]
}
