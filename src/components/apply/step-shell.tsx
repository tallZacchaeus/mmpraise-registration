'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, CloudOff, Loader2, Save } from 'lucide-react'
import { Alert, Button, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { ErrorSummary } from '@/components/ui/form'
import type { FieldErrors } from '@/lib/actions/result'
import { WIZARD_STEPS, stepByNumber } from '@/lib/validation/registration'

/**
 * Chrome shared by every wizard step: heading, error summary, autosave status,
 * and the Previous / Save-and-exit / Next controls.
 */
export function StepShell({
  stepNumber,
  title,
  description,
  errors,
  errorLabels,
  formError,
  pending,
  saveState,
  onSubmit,
  onSaveAndExit,
  children,
  nextLabel,
}: {
  stepNumber: number
  title: string
  description?: string
  errors: FieldErrors
  errorLabels?: Record<string, string>
  formError: string | null
  pending: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onSubmit: (event?: React.FormEvent) => void
  onSaveAndExit: () => void
  children: React.ReactNode
  nextLabel?: string
}) {
  const previous = stepNumber > 1 ? stepByNumber(stepNumber - 1) : null
  const summary = Object.entries(errors).map(([field, message]) => ({
    field: `field-${field}`,
    message: errorLabels?.[field] ? `${errorLabels[field]}: ${message}` : message,
  }))

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader
          title={title}
          description={description}
          action={
            <p className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
              {saveState === 'saving' && (
                <>
                  <Loader2 aria-hidden className="size-3.5 animate-spin" /> Saving…
                </>
              )}
              {saveState === 'saved' && (
                <>
                  <Check aria-hidden className="size-3.5 text-success" /> Draft saved
                </>
              )}
              {saveState === 'error' && (
                <>
                  <CloudOff aria-hidden className="size-3.5 text-danger" /> Draft not saved
                </>
              )}
            </p>
          }
        />

        <CardBody className="space-y-6">
          <ErrorSummary id="step-errors" errors={summary} />
          {formError && (
            <Alert tone="danger" title="Something went wrong">
              {formError}
            </Alert>
          )}
          {children}
        </CardBody>
      </Card>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {previous ? (
            <Link
              href={`/apply/${previous.slug}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-ink px-6 py-3 font-display text-sm font-bold uppercase text-ink hover:bg-ink hover:text-white"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Previous
            </Link>
          ) : (
            <span />
          )}

          <Button type="button" variant="ghost" onClick={onSaveAndExit} disabled={pending}>
            <Save aria-hidden className="size-4" />
            Save and continue later
          </Button>
        </div>

        <Button type="submit" size="lg" isLoading={pending}>
          {nextLabel ?? (stepNumber === WIZARD_STEPS.length ? 'Submit registration' : 'Save and continue')}
          {!pending && <ArrowRight aria-hidden className="size-4" />}
        </Button>
      </div>
    </form>
  )
}
