'use client'

import { Radio } from 'lucide-react'
import { useEventCountdown } from '@/lib/countdown'
import { cn } from '@/lib/utils'

/**
 * The countdown as an operational figure, not a spectacle.
 *
 * Same state machine as the homepage and the volunteer dashboard —
 * `useEventCountdown`, the platform's only clock — presented at label size on
 * a light card. An administrator needs "208 days" as a planning fact; the
 * cinematic treatment belongs on the public site.
 */
export function AdminCountdown({
  startsAtIso,
  endsAtIso,
  className,
}: {
  startsAtIso: string | null
  endsAtIso: string | null
  className?: string
}) {
  const { state, remaining } = useEventCountdown(startsAtIso, endsAtIso)

  if (state === 'unscheduled') {
    return <p className={cn('text-sm text-muted', className)}>Event date not configured.</p>
  }

  if (state === 'live') {
    return (
      <p className={cn('inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-primary-active', className)}>
        <Radio aria-hidden className="size-4" />
        Live now
      </p>
    )
  }

  if (state === 'completed') {
    return (
      <p className={cn('font-display text-sm font-bold uppercase tracking-wide text-muted', className)}>
        Edition concluded
      </p>
    )
  }

  const units: [string, number][] = [
    ['days', remaining.days],
    ['hrs', remaining.hours],
    ['min', remaining.minutes],
  ]

  return (
    <div className={className}>
      {/*
        Whole minutes only. Seconds on an admin dashboard are movement without
        information — nobody plans an event to the second, and a ticking digit
        pulls the eye every time it changes.
      */}
      <p aria-hidden className="flex items-baseline gap-3">
        {units.map(([label, value]) => (
          <span key={label} className="flex items-baseline gap-1">
            <span className="font-display text-2xl font-bold tabular-nums text-ink">
              {String(value).padStart(2, '0')}
            </span>
            <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
          </span>
        ))}
      </p>
      <p className="sr-only">
        {remaining.days} days, {remaining.hours} hours and {remaining.minutes} minutes until the
        event begins.
      </p>
    </div>
  )
}
