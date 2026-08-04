'use client'

import Link from 'next/link'
import { CalendarClock, MapPin } from 'lucide-react'
import { CountdownCompact } from '@/components/volunteer/countdown-compact'
import { Badge, buttonClass } from '@/components/ui/primitives'
import { Progress } from '@/components/ui/progress'
import type { LifecyclePhase } from '@/lib/applications/journey'
import { useIntroTimeline } from '@/lib/motion'

/**
 * The dashboard's opening statement.
 *
 * The old dashboard opened with a plain line of text and a status pill floated
 * to the right, which left the volunteer to work out for themselves whether
 * anything was expected of them. This says it: one sentence that changes with
 * the phase of the journey, and one button that is always the next thing to do.
 *
 * The dark band is the same treatment the public site gives its countdown, so a
 * volunteer who has just come from the homepage recognises where they are.
 */

type Action = { label: string; href: string; external?: boolean }

const HEADLINES: Record<LifecyclePhase, string> = {
  not_started: 'Your registration is waiting',
  in_progress: 'Pick up where you left off',
  awaiting_review: 'Your application is with the team',
  approved: 'You are on the team',
  waitlisted: 'You are on the waiting list',
  not_accepted: 'Thank you for applying',
  event_week: 'It is almost here',
  live: 'Praise is under way',
  finished: 'Thank you for serving',
}

export function DashboardHero({
  name,
  phase,
  editionLabel,
  statusLabel,
  statusTone,
  mmpCode,
  message,
  primaryAction,
  secondaryAction,
  progress,
  dateTimeLabel,
  venue,
  startsAtIso,
  endsAtIso,
  summary,
}: {
  name: string
  phase: LifecyclePhase
  /** "85 Hours · 2027 edition" */
  editionLabel: string
  /** Null until an application exists. */
  statusLabel: string | null
  statusTone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
  /** The volunteer's permanent MMP number. */
  mmpCode: string | null
  message: string
  primaryAction: Action
  secondaryAction?: Action
  /** Registration completeness. Null once the application has been submitted. */
  progress: { completed: number; total: number } | null
  dateTimeLabel: string
  venue: string
  startsAtIso: string | null
  endsAtIso: string | null
  summary: string
}) {
  const ref = useIntroTimeline<HTMLElement>((timeline, scope) => {
    /*
     * Guarded because the hero renders different children in different phases —
     * there is no status pill before an application exists, and no secondary
     * action in most phases. GSAP logs "target not found" for a selector that
     * matches nothing, on every single load.
     */
    const step = (selector: string, vars: gsap.TweenVars, at: number) => {
      const targets = scope.querySelectorAll<HTMLElement>(selector)
      if (targets.length > 0) timeline.from(targets, vars, at)
    }

    step('[data-hero-meta]', { opacity: 0, y: 12, duration: 0.5 }, 0)
    step('[data-hero-title]', { opacity: 0, y: 18, duration: 0.6 }, 0.08)
    step('[data-hero-message]', { opacity: 0, y: 14, duration: 0.6 }, 0.16)
    step('[data-hero-action]', { opacity: 0, y: 12, duration: 0.5, stagger: 0.06 }, 0.26)
    step('[data-hero-aside]', { opacity: 0, y: 16, duration: 0.6 }, 0.2)
  }, [phase])

  return (
    <section
      ref={ref}
      aria-labelledby="dashboard-heading"
      className="relative overflow-hidden rounded-card bg-night texture-grain px-5 py-7 sm:px-8 sm:py-10"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-center">
        <div className="min-w-0">
          <div data-hero-meta className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-pill border border-white/15 bg-white/8 px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-gold">
              {editionLabel}
            </span>
            {statusLabel && <Badge tone={statusTone}>{statusLabel}</Badge>}
          </div>

          {/*
            The greeting and the headline are one accessible name, so the
            trailing space is load-bearing: without it a screen reader reads
            "Welcome back, AdaezeYour registration is waiting".
          */}
          <h1 id="dashboard-heading" data-hero-title className="mt-4 text-white">
            <span className="block text-xl font-normal normal-case tracking-normal text-white/70 sm:text-2xl">
              Welcome back, {name}{' '}
            </span>
            <span className="mt-1 block text-3xl sm:text-4xl">{HEADLINES[phase]}</span>
          </h1>

          <p data-hero-message className="mt-4 max-w-2xl text-white/80">
            {message}
          </p>

          {/*
            The MMP number, shown from the moment the account exists — not the
            per-edition registration reference, which is internal. A volunteer
            has exactly one number, and this is it; showing two numbers that
            both begin "MMP" is how a check-in desk looks up the wrong one.
          */}
          {mmpCode && (
            <p data-hero-message className="mt-4 text-sm text-white/70">
              Your MMP number{' '}
              <span className="font-display font-bold tracking-wide text-white">{mmpCode}</span>
            </p>
          )}

          {/*
            The progress bar belongs in the hero only while there is progress to
            make. Once an application is submitted the figure is always 100% and
            a full bar says nothing — the status badge above already does.
          */}
          {progress && (
            <div data-hero-message className="mt-6 max-w-md">
              <p className="flex items-baseline justify-between gap-4 text-sm text-white/75">
                <span>Registration progress</span>
                <span className="tabular-nums" aria-hidden>
                  {progress.completed} of {progress.total}
                </span>
              </p>
              {/*
                Named "overall", because the registration card further down has
                a progressbar of its own for the same figure. Two controls with
                near-identical accessible names are indistinguishable in a
                screen reader's element list; these say which is which.
              */}
              <Progress
                className="mt-2 h-1.5 bg-white/15"
                value={progress.completed}
                max={progress.total}
                label={`Overall registration progress: ${progress.completed} of ${progress.total} sections complete`}
                barClassName="bg-brand-bright"
              />
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <HeroAction action={primaryAction} variant="primary" />
            {secondaryAction && <HeroAction action={secondaryAction} variant="outlineOnDark" />}
          </div>
        </div>

        <div data-hero-aside className="min-w-0">
          <CountdownCompact
            startsAtIso={startsAtIso}
            endsAtIso={endsAtIso}
            summary={summary}
          />
          <p className="mt-3 flex items-center gap-2 text-sm text-white/75">
            <CalendarClock aria-hidden className="size-4 shrink-0" />
            {dateTimeLabel}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/60">
            <MapPin aria-hidden className="size-4 shrink-0" />
            {venue}
          </p>
        </div>
      </div>
    </section>
  )
}

function HeroAction({
  action,
  variant,
}: {
  action: Action
  variant: 'primary' | 'outlineOnDark'
}) {
  const className = buttonClass({ variant, size: 'md' })

  if (action.external) {
    return (
      <a
        data-hero-action
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {action.label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    )
  }

  return (
    <Link data-hero-action href={action.href} className={className}>
      {action.label}
    </Link>
  )
}
