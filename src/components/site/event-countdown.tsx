'use client'

import { useMemo, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { CalendarCheck, CalendarClock, PlayCircle, Radio } from 'lucide-react'
import { buttonClass } from '@/components/ui/primitives'

/**
 * Countdown to the event, with real end-states.
 *
 * The current site's timer sits permanently at 00:00:00:00 because its target
 * date has passed. This one derives its state from the configured start and end
 * times and never shows a negative value:
 *
 *   upcoming  → ticking counter
 *   live      → "Praise is live now" + watch link
 *   completed → "This edition has finished" + highlights link
 *
 * The clock is an external mutable source, so it is read through
 * `useSyncExternalStore` rather than a setState-on-interval effect: React then
 * handles the server snapshot and hydration itself.
 */
type Remaining = { days: number; hours: number; minutes: number; seconds: number }

const ZERO: Remaining = { days: 0, hours: 0, minutes: 0, seconds: 0 }

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 1000)
  return () => clearInterval(timer)
}

/** Bucketed to whole seconds so the snapshot is stable between ticks. */
const getSnapshot = () => Math.floor(Date.now() / 1000)

/** The server has no clock the client can agree with, so it renders zeros. */
const getServerSnapshot = () => 0

export type CountdownState = 'unscheduled' | 'upcoming' | 'live' | 'completed'

export function EventCountdown({
  startsAtIso,
  endsAtIso,
  watchHref,
  highlightsHref,
  subscribeHref = '#updates',
}: {
  /** Null while the date is still to be announced. */
  startsAtIso: string | null
  endsAtIso: string | null
  watchHref: string
  highlightsHref: string
  subscribeHref?: string
}) {
  const nowSeconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const { state, remaining } = useMemo(() => {
    // No confirmed date yet — never invent one, and never count to zero.
    if (!startsAtIso || !endsAtIso) {
      return { state: 'unscheduled' as CountdownState, remaining: ZERO }
    }

    const start = Math.floor(new Date(startsAtIso).getTime() / 1000)
    const end = Math.floor(new Date(endsAtIso).getTime() / 1000)

    // Before hydration the snapshot is 0; show the upcoming layout so the
    // markup matches what the server rendered.
    if (!Number.isFinite(start) || nowSeconds === 0) {
      return { state: 'upcoming' as CountdownState, remaining: ZERO }
    }

    if (nowSeconds >= end) return { state: 'completed' as CountdownState, remaining: ZERO }
    if (nowSeconds >= start) return { state: 'live' as CountdownState, remaining: ZERO }

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

  if (state === 'unscheduled') {
    return (
      <div className="text-center">
        <p className="inline-flex items-center gap-2 rounded-pill bg-white/15 px-4 py-2 font-display text-sm font-bold uppercase tracking-wide text-white">
          <CalendarClock aria-hidden className="size-4" />
          Dates to be announced
        </p>
        <p className="mx-auto mt-4 max-w-xl text-white/80">
          The date for the next edition has not been confirmed yet. Join the mailing list and we will
          tell you as soon as it is.
        </p>
        <Link href={subscribeHref} className={buttonClass({ size: 'lg', className: 'mt-6' })}>
          Get the announcement
        </Link>
      </div>
    )
  }

  if (state === 'live') {
    return (
      <div className="text-center">
        <p className="inline-flex items-center gap-2 rounded-pill bg-primary px-4 py-2 font-display text-sm font-bold uppercase tracking-wide text-white">
          <Radio aria-hidden className="size-4" />
          Praise is live now
        </p>
        <p className="mx-auto mt-4 max-w-xl text-white/80">
          The marathon is under way. Join the worship from wherever you are.
        </p>
        <Link href={watchHref} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: 'lg', className: 'mt-6' })}>
          <PlayCircle aria-hidden className="size-4" />
          Watch live
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      </div>
    )
  }

  if (state === 'completed') {
    return (
      <div className="text-center">
        <p className="inline-flex items-center gap-2 rounded-pill bg-white/15 px-4 py-2 font-display text-sm font-bold uppercase tracking-wide text-white">
          <CalendarCheck aria-hidden className="size-4" />
          This edition has finished
        </p>
        <p className="mx-auto mt-4 max-w-xl text-white/80">
          Thank you to everyone who praised with us. Relive the moments while we prepare for the next edition.
        </p>
        <Link
          href={highlightsHref}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ size: 'lg', className: 'mt-6' })}
        >
          <PlayCircle aria-hidden className="size-4" />
          View highlights
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      </div>
    )
  }

  const units: [string, number][] = [
    ['Days', remaining.days],
    ['Hours', remaining.hours],
    ['Minutes', remaining.minutes],
    ['Seconds', remaining.seconds],
  ]

  return (
    <div>
      <ul className="flex flex-wrap justify-center gap-4 sm:gap-10">
        {units.map(([label, value]) => (
          <li key={label} className="min-w-[4.5rem] text-center">
            <span className="block font-display text-4xl font-bold tabular-nums text-white sm:text-6xl">
              {String(value).padStart(2, '0')}
            </span>
            <span className="mt-1 block text-xs text-white/70 sm:text-sm">{label}</span>
          </li>
        ))}
      </ul>

      {/* Announced as one sentence rather than four numbers ticking every
          second, which would flood a screen reader. */}
      <p className="sr-only" aria-live="polite">
        {remaining.days} days, {remaining.hours} hours and {remaining.minutes} minutes until the marathon begins.
      </p>
    </div>
  )
}
