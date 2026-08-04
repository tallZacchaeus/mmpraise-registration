'use client'

import { Radio } from 'lucide-react'
import { useEventCountdown } from '@/lib/countdown'
import { cn } from '@/lib/utils'

/**
 * The dashboard's clock.
 *
 * Deliberately not the homepage's four huge digits. A signed-in volunteer came
 * here to do something — finish a form, read a decision, check a shift — and a
 * 60px ticking counter would take the page's first glance away from that. This
 * states the same four units at a quarter of the size, inside the hero, and
 * hands the emphasis back to the primary action beside it.
 *
 * The state machine is `useEventCountdown`, shared with the homepage, so the
 * two can never disagree about whether praise has started.
 */
export function CountdownCompact({
  startsAtIso,
  endsAtIso,
  summary,
  className,
}: {
  startsAtIso: string | null
  endsAtIso: string | null
  /** The full sentence, read by assistive technology instead of the digits. */
  summary: string
  className?: string
}) {
  const { state, remaining } = useEventCountdown(startsAtIso, endsAtIso)

  if (state === 'unscheduled') {
    return (
      <div className={cn('rounded-card border border-white/12 bg-white/6 p-4 text-center', className)}>
        <p className="text-sm text-white/80">The date for the next edition has not been confirmed yet.</p>
      </div>
    )
  }

  if (state === 'live') {
    return (
      <div className={cn('rounded-card border border-white/12 bg-white/6 p-4 text-center', className)}>
        <p className="inline-flex items-center gap-2 rounded-pill bg-primary px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-white">
          <Radio aria-hidden className="size-3.5" />
          Praise is live now
        </p>
      </div>
    )
  }

  if (state === 'completed') {
    return (
      <div className={cn('rounded-card border border-white/12 bg-white/6 p-4 text-center', className)}>
        <p className="font-display text-sm font-bold uppercase tracking-wide text-gold">
          This edition has concluded
        </p>
      </div>
    )
  }

  const units: [string, number][] = [
    ['Days', remaining.days],
    ['Hrs', remaining.hours],
    ['Min', remaining.minutes],
    ['Sec', remaining.seconds],
  ]

  return (
    <div className={cn('rounded-card border border-white/12 bg-white/6 p-4', className)}>
      <p className="text-center font-display text-xs font-bold uppercase tracking-[0.18em] text-gold">
        Time until the first hour
      </p>

      {/*
        Two columns at 320px, four from 360px up. On the narrowest supported
        phone a four-across row leaves each unit about 55px, which is not enough
        for "Days" at this tracking without it wrapping mid-word.
      */}
      <ul aria-hidden className="mt-3 grid grid-cols-2 gap-2 min-[360px]:grid-cols-4">
        {units.map(([label, value]) => (
          <li key={label} className="rounded-field bg-white/8 px-2 py-3 text-center">
            {/* `tabular-nums` keeps the row from jittering sideways once a second. */}
            <span className="block font-display text-2xl font-bold tabular-nums text-white sm:text-3xl">
              {String(value).padStart(2, '0')}
            </span>
            <span className="mt-1 block text-[0.6875rem] uppercase tracking-[0.14em] text-white/70">
              {label}
            </span>
          </li>
        ))}
      </ul>

      {/*
        `aria-live="off"`: the digits change every second, and a polite region
        would queue an announcement each time — the countdown would talk over
        everything else on the page indefinitely. The sentence is read once, on
        arrival, and the digits above are hidden from assistive technology.
      */}
      <p className="sr-only" aria-live="off">
        {summary}
      </p>
    </div>
  )
}
