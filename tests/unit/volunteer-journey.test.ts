import { describe, expect, it } from 'vitest'
import type { ApplicationStatus } from '@/generated/prisma/enums'
import { STATUS_LABELS } from '@/lib/applications/status'
import { buildJourney, isAccepted, lifecyclePhase } from '@/lib/applications/journey'
import { buildNotifications } from '@/lib/applications/notifications'

/**
 * The dashboard's state machine.
 *
 * Both functions are pure and take the event's timing as arguments, so every
 * point in the edition's life — a year out, the morning of, mid-marathon, the
 * week after — can be tested without a clock or a database.
 */

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[]

describe('lifecyclePhase', () => {
  it('asks an unfinished draft to finish, even on the morning of the event', () => {
    // The single most important case: the event starting does not change what
    // someone with a half-finished form needs to be told.
    expect(lifecyclePhase({ status: 'DRAFT', eventState: 'live', daysUntilEvent: 0 })).toBe(
      'in_progress',
    )
    expect(lifecyclePhase({ status: null, eventState: 'live', daysUntilEvent: 0 })).toBe(
      'not_started',
    )
    expect(lifecyclePhase({ status: 'SUBMITTED', eventState: 'live', daysUntilEvent: 0 })).toBe(
      'awaiting_review',
    )
  })

  it('switches to the event phases only for volunteers who are on the team', () => {
    expect(lifecyclePhase({ status: 'ASSIGNED', eventState: 'upcoming', daysUntilEvent: 5 })).toBe(
      'event_week',
    )
    expect(lifecyclePhase({ status: 'ASSIGNED', eventState: 'upcoming', daysUntilEvent: 8 })).toBe(
      'approved',
    )
    expect(lifecyclePhase({ status: 'APPROVED', eventState: 'live', daysUntilEvent: 0 })).toBe('live')
    expect(lifecyclePhase({ status: 'APPROVED', eventState: 'completed', daysUntilEvent: 0 })).toBe(
      'finished',
    )

    // Rejected and waitlisted volunteers keep their own phase throughout.
    expect(lifecyclePhase({ status: 'REJECTED', eventState: 'live', daysUntilEvent: 0 })).toBe(
      'not_accepted',
    )
    expect(lifecyclePhase({ status: 'WAITLISTED', eventState: 'live', daysUntilEvent: 0 })).toBe(
      'waitlisted',
    )
  })

  it('treats a completed application as finished whatever the clock says', () => {
    expect(lifecyclePhase({ status: 'COMPLETED', eventState: 'upcoming', daysUntilEvent: 200 })).toBe(
      'finished',
    )
  })

  it('never claims the event has begun while no date is confirmed', () => {
    for (const status of ALL_STATUSES) {
      const phase = lifecyclePhase({ status, eventState: 'unscheduled', daysUntilEvent: null })
      expect(['event_week', 'live']).not.toContain(phase)
    }
  })

  it('returns a phase for every status the database can hold', () => {
    for (const status of [...ALL_STATUSES, null]) {
      expect(lifecyclePhase({ status, eventState: 'upcoming', daysUntilEvent: 200 })).toBeTruthy()
    }
  })
})

describe('isAccepted', () => {
  it('is true only once a place has actually been offered', () => {
    expect(ALL_STATUSES.filter(isAccepted)).toEqual([
      'APPROVED',
      'ASSIGNED',
      'CHECKED_IN',
      'COMPLETED',
    ])
    expect(isAccepted(null)).toBe(false)
  })
})

describe('buildJourney', () => {
  const STAGES = [
    'account',
    'registration',
    'submitted',
    'review',
    'approved',
    'department',
    'accommodation',
    'shifts',
    'ready',
  ]

  it('always returns the same nine stages in the same order', () => {
    for (const status of [...ALL_STATUSES, null]) {
      expect(buildJourney({ status }).map((m) => m.id)).toEqual(STAGES)
    }
  })

  it('marks at most one stage as current, and exactly one while in flight', () => {
    for (const status of [...ALL_STATUSES, null]) {
      const current = buildJourney({ status }).filter((m) => m.state === 'current')
      // COMPLETED is entirely behind the volunteer; REJECTED stops.
      const expected = status === 'COMPLETED' || status === 'REJECTED' ? 0 : 1
      expect(current, `status ${status}`).toHaveLength(expected)
    }
  })

  it('never moves backwards: a completed stage stays completed', () => {
    const order: (ApplicationStatus | null)[] = [
      null,
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'ASSIGNED',
      'CHECKED_IN',
      'COMPLETED',
    ]

    let previous = 0
    for (const status of order) {
      const complete = buildJourney({
        status,
        departmentName: 'Ushering',
        shiftCount: status === 'ASSIGNED' || status === 'CHECKED_IN' || status === 'COMPLETED' ? 2 : 0,
      }).filter((m) => m.state === 'complete').length
      expect(complete, `status ${status}`).toBeGreaterThanOrEqual(previous)
      previous = complete
    }
  })

  it('reports accommodation as untracked rather than pretending it is pending', () => {
    // The platform stores no accommodation record. Marking the stage "upcoming"
    // would promise a volunteer something is coming to this page; it is not.
    const stage = buildJourney({ status: 'APPROVED' }).find((m) => m.id === 'accommodation')!
    expect(stage.state).toBe('unknown')
    expect(stage.description).toMatch(/not published through this dashboard/i)

    const published = buildJourney({ status: 'APPROVED', accommodationPublished: true }).find(
      (m) => m.id === 'accommodation',
    )!
    expect(published.state).toBe('complete')
  })

  it('stops every downstream stage rather than guessing after a rejection', () => {
    const journey = buildJourney({ status: 'REJECTED', departmentName: 'Ushering' })
    for (const id of ['department', 'accommodation', 'shifts', 'ready']) {
      expect(journey.find((m) => m.id === id)!.state, id).toBe('stopped')
    }
    // The decision itself was still reached.
    expect(journey.find((m) => m.id === 'approved')!.description).toMatch(/not accepted/i)
  })

  it('confirms the department only once the volunteer has been approved', () => {
    const submitted = buildJourney({ status: 'SUBMITTED', departmentName: 'Ushering' })
    expect(submitted.find((m) => m.id === 'department')!.state).toBe('upcoming')
    expect(submitted.find((m) => m.id === 'department')!.description).toMatch(/asked to serve/i)

    const approved = buildJourney({ status: 'APPROVED', departmentName: 'Ushering' })
    expect(approved.find((m) => m.id === 'department')!.state).toBe('complete')
    expect(approved.find((m) => m.id === 'department')!.description).toMatch(/serving with Ushering/i)
  })

  it('reports the sections finished while the application is a draft', () => {
    expect(buildJourney({ status: 'DRAFT', completedSteps: 0 })[1].description).toMatch(
      /nothing has been entered/i,
    )
    expect(buildJourney({ status: 'DRAFT', completedSteps: 3 })[1].description).toMatch(
      /3 of 8 sections finished/i,
    )
    // Once submitted the section count is behind them and stops being mentioned.
    expect(buildJourney({ status: 'SUBMITTED', completedSteps: 8 })[1].description).not.toMatch(
      /of 8/,
    )
  })

  it('treats a checked-in volunteer as having a rota even without assignment rows', () => {
    const journey = buildJourney({ status: 'CHECKED_IN', shiftCount: 0 })
    expect(journey.find((m) => m.id === 'shifts')!.state).toBe('complete')
    expect(journey.find((m) => m.id === 'ready')!.state).toBe('current')
  })

  it('tells an unverified volunteer to confirm their email at the first stage', () => {
    expect(buildJourney({ status: 'DRAFT', emailVerified: false })[0].description).toMatch(
      /confirm your email/i,
    )
    expect(buildJourney({ status: 'DRAFT', emailVerified: true })[0].description).toMatch(
      /confirmed/i,
    )
  })
})

describe('buildNotifications', () => {
  const t = (iso: string) => new Date(iso)

  const base = {
    accountCreatedAt: t('2026-08-01T09:00:00Z'),
    emailVerifiedAt: t('2026-08-01T09:05:00Z'),
    application: null,
    statusHistory: [],
    assignments: [],
  }

  it('always reports the account, and the email only once confirmed', () => {
    expect(buildNotifications(base).map((n) => n.id)).toEqual([
      'email-verified',
      'account-created',
    ])
    expect(
      buildNotifications({ ...base, emailVerifiedAt: null }).map((n) => n.id),
    ).toEqual(['account-created'])
  })

  it('reports a saved draft only while there is a draft', () => {
    const draft = buildNotifications({
      ...base,
      application: {
        status: 'DRAFT',
        updatedAt: t('2026-08-02T10:00:00Z'),
        submittedAt: null,
        departmentName: null,
      },
    })
    expect(draft[0].id).toBe('draft-saved')

    /*
     * After submission `updatedAt` moves for reasons that have nothing to do
     * with the volunteer — a reviewer opening the record, an admin adding a
     * note — so reporting it as "your draft was saved" would be untrue.
     */
    const submitted = buildNotifications({
      ...base,
      application: {
        status: 'SUBMITTED',
        updatedAt: t('2026-08-09T10:00:00Z'),
        submittedAt: t('2026-08-02T10:00:00Z'),
        departmentName: null,
      },
    })
    expect(submitted.map((n) => n.id)).not.toContain('draft-saved')
  })

  it('prefers a reviewer’s own words to the generic sentence', () => {
    const [first] = buildNotifications({
      ...base,
      statusHistory: [
        {
          id: 'h1',
          toStatus: 'APPROVED',
          reason: 'Welcome — please read the briefing note.',
          createdAt: t('2026-08-10T10:00:00Z'),
        },
      ],
    })
    expect(first.body).toBe('Welcome — please read the briefing note.')
  })

  it('collapses a batch of shifts into one entry, not one per shift', () => {
    const items = buildNotifications({
      ...base,
      assignments: [
        { id: 'a', createdAt: t('2026-08-11T10:00:00Z') },
        { id: 'b', createdAt: t('2026-08-11T10:00:01Z') },
        { id: 'c', createdAt: t('2026-08-11T10:00:02Z') },
      ],
    })
    const shifts = items.filter((n) => n.kind === 'shifts')
    expect(shifts).toHaveLength(1)
    expect(shifts[0].title).toMatch(/3 shifts published/i)
    // Stamped at the moment the last one landed.
    expect(shifts[0].at.toISOString()).toBe('2026-08-11T10:00:02.000Z')
  })

  it('names the department at the moment of approval', () => {
    const items = buildNotifications({
      ...base,
      application: {
        status: 'APPROVED',
        updatedAt: t('2026-08-10T10:00:00Z'),
        submittedAt: t('2026-08-02T10:00:00Z'),
        departmentName: 'Ushering',
      },
      statusHistory: [
        { id: 'h1', toStatus: 'APPROVED', reason: null, createdAt: t('2026-08-10T10:00:00Z') },
      ],
    })
    const department = items.find((n) => n.kind === 'department')!
    expect(department.title).toBe('Department confirmed: Ushering')
    expect(department.at.toISOString()).toBe('2026-08-10T10:00:00.000Z')
  })

  it('is ordered newest first', () => {
    const items = buildNotifications({
      ...base,
      statusHistory: [
        { id: 'h2', toStatus: 'APPROVED', reason: null, createdAt: t('2026-08-10T10:00:00Z') },
        { id: 'h1', toStatus: 'SUBMITTED', reason: null, createdAt: t('2026-08-02T10:00:00Z') },
      ],
    })
    const times = items.map((n) => n.at.getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })
})
