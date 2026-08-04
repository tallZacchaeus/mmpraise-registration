import Image from 'next/image'
import Link from 'next/link'
import { CalendarClock, Globe2, MapPin, Users } from 'lucide-react'
import { EventPanel } from '@/components/site/event-panel'
import { Logo } from '@/components/ui/primitives'
import {
  eventConfig,
  eventStartsAt,
  eventSummarySentence,
  formatEventDateTime,
} from '@/config/site'

/**
 * Shell for the signed-out screens.
 *
 * Two columns on desktop — a 40/60 split, so the form has materially more room
 * than the panel beside it — and a single column on mobile with the **form
 * first**: the panel is atmosphere, and atmosphere must never push the task
 * below the fold on a phone.
 *
 * The panel is a photograph under a flat scrim rather than a flat colour. That
 * is the same treatment as the public site's heroes, so arriving at
 * registration from the homepage does not feel like arriving at a different
 * product.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const startsAt = eventStartsAt()

  const trustPoints = [
    { icon: Globe2, text: 'Worshippers from many nations' },
    { icon: Users, text: 'Ten departments, thousands serving' },
    { icon: CalendarClock, text: `${eventConfig.durationHours} hours of uninterrupted praise` },
    { icon: MapPin, text: eventConfig.venue.name },
  ]

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
      {/*
        Desktop only. Every child of this panel is already `lg:`-gated, so on a
        phone it rendered as an empty dark strip that still downloaded the
        photograph behind it. Removing it outright saves that request entirely
        and gets the form to the top of a small screen, which is the whole point
        of the mobile ordering.
      */}
      <aside className="relative isolate hidden overflow-hidden px-6 py-10 text-white lg:order-1 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-14">
        <Image
          src="/landing/activity-worship.webp"
          alt=""
          fill
          // The largest element on the desktop layout, so it is fetched at high
          // priority rather than discovered late. It never loads below `lg`.
          priority
          sizes="(min-width: 1024px) 40vw, 1px"
          className="-z-30 object-cover"
        />
        <div aria-hidden className="absolute inset-0 -z-20 bg-night/86" />
        <div aria-hidden className="texture-grain absolute inset-0 -z-10 opacity-60" />

        <Link href="/" aria-label="MMPraise home" className="inline-flex">
          <Logo inverted />
        </Link>

        <div className="mt-10">
          <p className="font-display text-3xl font-bold uppercase leading-tight text-white xl:text-4xl">
            Serve at
            <br />
            {/*
              From configuration, not from the `event_name` setting. That row
              is administrator-editable and had gone stale — it still read
              "84 Hours … 2026" long after the site had moved to 2027.
            */}
            <span className="text-gold">
              {eventConfig.editionName} {eventConfig.edition}
            </span>
          </p>

          <p className="mt-4 text-sm text-white/75">
            Begins {startsAt ? formatEventDateTime(startsAt) : 'on a date to be announced'}
          </p>

          <p className="mt-6 max-w-md text-white/80">
            Register once, choose a department, and manage everything from your volunteer
            dashboard. You can save your progress and finish on any device.
          </p>

          <ul className="mt-10 space-y-4">
            {trustPoints.map((point) => (
              <li key={point.text} className="flex items-center gap-3 text-sm text-white/85">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-card bg-white/10">
                  <point.icon aria-hidden className="size-4" />
                </span>
                {point.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-10 text-xs text-white/60">
          © {new Date().getFullYear()} MMPraise. All rights reserved.
        </p>
      </aside>

      <main
        id="main"
        className="order-1 flex flex-1 items-start justify-center px-4 py-10 sm:px-6 lg:order-2 lg:items-center lg:px-12 lg:py-14"
      >
        {/* Wider than the previous max-w-lg: the two-up name fields were cramped,
            and a form that fills its column reads as the page's purpose rather
            than as a widget sitting on it. */}
        <div className="w-full max-w-xl">
          <div className="mb-8 space-y-5 lg:hidden">
            <Link href="/" aria-label="MMPraise Volunteers home">
              <Logo />
            </Link>
            {/* Mobile only: the brand panel is hidden there, so this carries
                the edition and date without displacing the form. */}
            <EventPanel
              editionName={eventConfig.editionName}
              edition={eventConfig.edition}
              dateTimeLabel={startsAt ? formatEventDateTime(startsAt) : 'Date to be announced'}
              venue={eventConfig.venue.name}
              startsAtIso={eventConfig.startsAt}
              summary={eventSummarySentence()}
            />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
