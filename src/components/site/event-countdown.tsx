'use client'

import Link from 'next/link'
import { CalendarCheck, CalendarClock, PlayCircle, Radio } from 'lucide-react'
import { CtaPair } from '@/components/site/cta'
import { buttonClass } from '@/components/ui/primitives'
import { useEventCountdown } from '@/lib/countdown'

/**
 * The homepage countdown: the full four-unit clock, on the dark band.
 *
 * The state machine — upcoming, live, completed, or not yet scheduled — lives
 * in `useEventCountdown` so this component and the compact dashboard clock can
 * never disagree about which one is true. Everything below is presentation:
 *
 *   upcoming  → ticking counter
 *   live      → "Praise is live now" + watch link
 *   completed → "This edition has finished" + highlights link
 */
export type { CountdownState } from '@/lib/countdown'

export function EventCountdown({
  startsAtIso,
  endsAtIso,
  watchHref,
  highlightsHref,
  subscribeHref = '#updates',
  summary,
  venue,
  edition,
}: {
  /** Null while the date is still to be announced. */
  startsAtIso: string | null
  endsAtIso: string | null
  watchHref: string
  highlightsHref: string
  subscribeHref?: string
  /** The full sentence, also used as the screen-reader summary. */
  summary: string
  venue: string
  edition: string
}) {
  const { state, remaining } = useEventCountdown(startsAtIso, endsAtIso)

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
          The {edition} Marathon Messiah’s Praise has concluded
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
      <p className="mb-6 text-center text-white/85">{summary}</p>

      <ul className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {units.map(([label, value]) => (
          <li
            key={label}
            className="rounded-card border border-white/12 bg-white/6 px-3 py-5 text-center backdrop-blur-sm"
          >
            {/*
              `tabular-nums` matters more than it looks: without it the digits
              have different widths and the whole row jitters sideways once a
              second, which is far more distracting than the count itself.
            */}
            <span className="block font-display text-4xl font-bold tabular-nums text-white sm:text-5xl lg:text-6xl">
              {String(value).padStart(2, '0')}
            </span>
            <span className="mt-2 block text-xs uppercase tracking-[0.18em] text-gold sm:text-sm">
              {label}
            </span>
          </li>
        ))}
      </ul>

      {/*
        `aria-live="off"` is deliberate. The numbers re-render every second, and
        a polite region would queue an announcement each time — the countdown
        would talk over everything else on the page indefinitely. The static
        sentence below carries the same information, read once on arrival, and
        `EventStateAnnouncer` speaks only when the state actually changes.
      */}
      <p className="sr-only" aria-live="off">
        {summary}
      </p>

      <div className="mt-8 text-center">
        <p className="text-sm text-white/70">{venue}</p>
        <CtaPair className="mt-5" align="center" onDark />
      </div>
    </div>
  )
}
