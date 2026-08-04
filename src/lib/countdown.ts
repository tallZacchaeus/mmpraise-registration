'use client'

import { useMemo, useSyncExternalStore } from 'react'

/**
 * The countdown clock, in one place.
 *
 * Two surfaces now count down to the same instant — the public homepage and the
 * volunteer dashboard — and they must never disagree about whether the event is
 * upcoming, live or finished. Re-deriving that from `Date.now()` in each
 * component is how two clocks drift apart, so the state machine lives here and
 * the components are left with nothing but presentation.
 *
 * The clock is an external mutable source, so it is read through
 * `useSyncExternalStore` rather than a setState-on-interval effect: React then
 * handles the server snapshot and hydration itself.
 */

export type CountdownState = 'unscheduled' | 'upcoming' | 'live' | 'completed'

export type Remaining = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export const ZERO_REMAINING: Remaining = { days: 0, hours: 0, minutes: 0, seconds: 0 }

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 1000)
  return () => clearInterval(timer)
}

/** Bucketed to whole seconds so the snapshot is stable between ticks. */
const getSnapshot = () => Math.floor(Date.now() / 1000)

/** The server has no clock the client can agree with, so it renders zeros. */
const getServerSnapshot = () => 0

/**
 * Resolve the event's state and the time left until it begins.
 *
 * Never returns a negative figure: the current WordPress site's timer sits
 * permanently at 00:00:00:00 because it counts to a date that has passed, and
 * the three explicit end-states below are what prevent that.
 */
export function useEventCountdown(
  startsAtIso: string | null,
  endsAtIso: string | null,
): { state: CountdownState; remaining: Remaining } {
  const nowSeconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return useMemo(() => {
    // No confirmed date yet — never invent one, and never count to zero.
    if (!startsAtIso || !endsAtIso) {
      return { state: 'unscheduled' as CountdownState, remaining: ZERO_REMAINING }
    }

    const start = Math.floor(new Date(startsAtIso).getTime() / 1000)
    const end = Math.floor(new Date(endsAtIso).getTime() / 1000)

    // Before hydration the snapshot is 0; show the upcoming layout so the
    // markup matches what the server rendered.
    if (!Number.isFinite(start) || nowSeconds === 0) {
      return { state: 'upcoming' as CountdownState, remaining: ZERO_REMAINING }
    }

    if (nowSeconds >= end) return { state: 'completed' as CountdownState, remaining: ZERO_REMAINING }
    if (nowSeconds >= start) return { state: 'live' as CountdownState, remaining: ZERO_REMAINING }

    const diff = Math.max(0, start - nowSeconds)
    return {
      state: 'upcoming' as CountdownState,
      remaining: {
        days: Math.floor(diff / 86_400),
        hours: Math.floor((diff / 3_600) % 24),
        minutes: Math.floor((diff / 60) % 60),
        seconds: Math.floor(diff % 60),
      },
    }
  }, [startsAtIso, endsAtIso, nowSeconds])
}
