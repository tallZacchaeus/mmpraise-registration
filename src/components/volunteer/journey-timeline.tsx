'use client'

import { Check, Circle, HelpCircle, Loader2, Minus } from 'lucide-react'
import type { JourneyMilestone, MilestoneState } from '@/lib/applications/journey'
import { useReveal } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * The nine-stage journey, drawn as one vertical rail.
 *
 * Vertical at every width, deliberately. Nine stages laid out horizontally
 * would give each about 130px on a 1440px screen, which is not a timeline —
 * it is nine columns of wrapped words. Going vertical instead buys the full
 * page width for each row, so the title and its explanation sit side by side on
 * a wide screen and stack on a narrow one, and the rail stays legible from
 * 320px to 1920px without a second layout to maintain.
 *
 * State is never carried by colour alone: each marker has a distinct glyph and
 * each row a visually hidden state word.
 */

const STATE_WORDS: Record<MilestoneState, string> = {
  complete: 'Completed',
  current: 'In progress',
  upcoming: 'Not started yet',
  stopped: 'Not applicable',
  unknown: 'Not tracked here',
}

const MARKER_STYLES: Record<MilestoneState, string> = {
  complete: 'border-success bg-success text-white',
  current: 'border-primary bg-primary text-white',
  upcoming: 'border-line-strong bg-surface text-muted',
  stopped: 'border-line-strong bg-surface-sunken text-muted',
  unknown: 'border-line-strong bg-surface text-muted',
}

function MarkerIcon({ state }: { state: MilestoneState }) {
  if (state === 'complete') return <Check aria-hidden className="size-4" />
  // Static, not spinning: a review takes days, and a spinner implies seconds.
  if (state === 'current') return <Loader2 aria-hidden className="size-4" />
  if (state === 'stopped') return <Minus aria-hidden className="size-4" />
  if (state === 'unknown') return <HelpCircle aria-hidden className="size-4" />
  return <Circle aria-hidden className="size-2.5" />
}

export function JourneyTimeline({ milestones }: { milestones: JourneyMilestone[] }) {
  const ref = useReveal<HTMLDivElement>({ stagger: 0.05, selector: '[data-milestone]', y: 14 })

  return (
    <div ref={ref}>
      <ol>
        {milestones.map((milestone, index) => {
          const isLast = index === milestones.length - 1
          /*
           * The connector belongs to the stage *above* the join and is tinted
           * by that stage's state, so the rail is green as far as the volunteer
           * has actually reached and neutral beyond it.
           */
          const connector = milestone.state === 'complete' ? 'bg-success' : 'bg-line'

          return (
            <li
              key={milestone.id}
              data-milestone
              aria-current={milestone.state === 'current' ? 'step' : undefined}
              className={cn('relative flex gap-4', isLast ? 'pb-0' : 'pb-5')}
            >
              {!isLast && (
                <span
                  aria-hidden
                  className={cn('absolute bottom-1 left-[0.9375rem] top-9 w-px', connector)}
                />
              )}

              <span className="shrink-0">
                <span
                  aria-hidden
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full border-2',
                    MARKER_STYLES[milestone.state],
                  )}
                >
                  <MarkerIcon state={milestone.state} />
                </span>
              </span>

              {/*
                Title and explanation share a row from `md` up and stack below
                it. The title column is fixed so the nine explanations line up
                into a readable second column rather than starting at nine
                different x positions.
              */}
              <span className="min-w-0 flex-1 pt-1 md:flex md:items-baseline md:gap-6">
                <span className="flex flex-wrap items-center gap-x-2 md:w-56 md:shrink-0">
                  <span
                    className={cn(
                      'font-display text-sm font-bold uppercase tracking-wide',
                      milestone.state === 'complete' || milestone.state === 'current'
                        ? 'text-ink'
                        : 'text-muted',
                    )}
                  >
                    {milestone.title}
                  </span>
                  <span className="sr-only">— {STATE_WORDS[milestone.state]}.</span>
                  {milestone.state === 'current' && (
                    <span className="rounded-pill bg-primary-subtle px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-primary-active">
                      Now
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-body md:mt-0">{milestone.description}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
