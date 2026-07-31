import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WIZARD_STEPS } from '@/lib/validation/registration'

/**
 * Wizard progress indicator.
 *
 * Announced to screen readers as "Step N of 8: Title" via aria-current and the
 * visually hidden status line, so progress does not depend on seeing the bar.
 * Completed steps are links; steps not yet reached are inert.
 */
export function ProgressSteps({ current, furthest }: { current: number; furthest: number }) {
  const currentStep = WIZARD_STEPS.find((s) => s.number === current) ?? WIZARD_STEPS[0]
  const percent = Math.round(((current - 1) / (WIZARD_STEPS.length - 1)) * 100)

  return (
    <nav aria-label="Registration progress" className="w-full">
      <p className="sr-only" aria-live="polite">
        Step {current} of {WIZARD_STEPS.length}: {currentStep.title}
      </p>

      {/* Mobile: compact bar */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-sm font-bold uppercase text-ink">
            Step {current} of {WIZARD_STEPS.length}
          </p>
          <p className="text-sm text-muted">{currentStep.title}</p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-line" role="presentation">
          <div className="h-full rounded-pill bg-primary transition-[width]" style={{ width: `${Math.max(percent, 6)}%` }} />
        </div>
      </div>

      {/* Desktop: full step list */}
      <ol className="hidden gap-1 lg:flex lg:flex-col">
        {WIZARD_STEPS.map((step) => {
          const isCurrent = step.number === current
          const isComplete = step.number < furthest
          const isReachable = step.number <= furthest

          const content = (
            <span className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                  isCurrent && 'border-primary bg-primary text-white',
                  !isCurrent && isComplete && 'border-success bg-success text-white',
                  !isCurrent && !isComplete && 'border-line-strong text-muted',
                )}
              >
                {isComplete && !isCurrent ? <Check className="size-4" /> : step.number}
              </span>
              <span className="min-w-0">
                <span className={cn('block font-display text-sm font-bold uppercase', isCurrent ? 'text-ink' : 'text-body')}>
                  {step.title}
                </span>
                <span className="block text-xs text-muted">{step.description}</span>
              </span>
            </span>
          )

          return (
            <li key={step.slug}>
              {isReachable && !isCurrent ? (
                <Link
                  href={`/apply/${step.slug}`}
                  className="block rounded-field px-3 py-2 hover:bg-surface-sunken"
                  aria-label={`Go to step ${step.number}: ${step.title}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-disabled={!isReachable || undefined}
                  className={cn('rounded-field px-3 py-2', isCurrent && 'bg-primary-subtle', !isReachable && 'opacity-60')}
                >
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
