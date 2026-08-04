import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/primitives'
import { eventConfig, formatEventDate, formatEventTime } from '@/config/site'

/**
 * The shifts a volunteer has been given.
 *
 * Times are formatted through the event formatters, which pin the zone to
 * Africa/Lagos. The previous list used the generic UTC formatter, so an
 * overnight shift starting at 02:00 WAT was shown to everyone — including
 * volunteers standing in Redemption City — as 01:00.
 */
export function ShiftList({
  shifts,
}: {
  shifts: {
    id: string
    name: string
    startsAt: Date
    endsAt: Date
    location: string | null
    period: string
  }[]
}) {
  return (
    <>
      <ol className="space-y-3">
      {shifts.map((shift) => (
        <li
          key={shift.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-line bg-surface-sunken px-4 py-3"
        >
          {/*
            The date block: what a volunteer scans for first.

            `basis-full` below 640px pushes the period badge onto its own line.
            Sharing the row with it on a 375px phone left the shift name about
            140px, which broke "Main entrance" across two lines and "Opening
            hours" across three.
          */}
          <span className="flex min-w-0 flex-1 basis-full items-center gap-4 sm:basis-auto">
            <span
              aria-hidden
              className="flex size-12 shrink-0 flex-col items-center justify-center rounded-field bg-surface text-center leading-none"
            >
              <span className="font-display text-lg font-bold text-ink">
                {formatEventDate(shift.startsAt).split(' ')[0]}
              </span>
              <span className="mt-0.5 text-[0.625rem] uppercase tracking-wide text-muted">
                {formatEventDate(shift.startsAt).split(' ')[1]?.slice(0, 3)}
              </span>
            </span>

            <span className="min-w-0">
              <span className="block font-display font-bold uppercase text-ink">{shift.name}</span>
              <span className="block text-sm text-muted">
                <span className="sr-only">{formatEventDate(shift.startsAt)}, </span>
                {formatEventTime(shift.startsAt)} — {formatEventTime(shift.endsAt)}
              </span>
              {shift.location && (
                <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                  <MapPin aria-hidden className="size-3.5 shrink-0" />
                  {shift.location}
                </span>
              )}
            </span>
          </span>

          <Badge tone="info">{shift.period.toLowerCase()}</Badge>
        </li>
      ))}
      </ol>

      {/*
        Outside the list: it is a note about the list, not an item in it, and a
        screen reader announcing "4 items" should be counting shifts.
      */}
      <p className="mt-3 text-xs text-muted">
        All times are {eventConfig.timezoneLabel} (West Africa Time), wherever you are reading this.
      </p>
    </>
  )
}
