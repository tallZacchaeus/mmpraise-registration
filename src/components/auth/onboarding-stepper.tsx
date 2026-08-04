import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type OnboardingStep = { id: string; label: string; description: string }

/**
 * Where the applicant is in the two-part journey.
 *
 * Replaces the sentence "Step 1 of 2", which stated a position without showing
 * a destination. An ordered list, so the sequence survives without the visual
 * treatment, with `aria-current="step"` marking the active one — that is the
 * attribute screen readers use to answer "where am I".
 *
 * The connecting rule is decorative and hidden; the list order already carries
 * the sequence.
 */
export function OnboardingStepper({
  steps,
  currentIndex,
}: {
  steps: OnboardingStep[]
  currentIndex: number
}) {
  return (
    <nav aria-label="Registration progress">
      <ol className="flex items-start gap-3">
        {steps.map((step, index) => {
          const complete = index < currentIndex
          const current = index === currentIndex

          return (
            <li
              key={step.id}
              className="flex flex-1 items-start gap-3"
              aria-current={current ? 'step' : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-pill text-xs font-bold transition-colors duration-300 motion-reduce:transition-none',
                  complete && 'bg-success text-white',
                  current && 'bg-primary text-white',
                  !complete && !current && 'border border-line-strong text-muted',
                )}
              >
                {complete ? <Check className="size-4" /> : index + 1}
              </span>

              <span className="min-w-0">
                <span
                  className={cn(
                    'block font-display text-sm font-bold uppercase tracking-wide',
                    current ? 'text-ink' : 'text-muted',
                  )}
                >
                  {step.label}
                  {/* Announced, never shown — the coloured dot conveys this
                      visually and would otherwise be lost to a screen reader. */}
                  <span className="sr-only">
                    {complete ? ' — completed' : current ? ' — current step' : ' — not started'}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">{step.description}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
