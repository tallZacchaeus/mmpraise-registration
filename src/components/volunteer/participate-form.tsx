'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, ShieldCheck, Users } from 'lucide-react'
import {
  confirmParticipationAction,
  type ConfirmParticipationInput,
} from '@/app/(volunteer)/participate/actions'
import { QuestionField } from '@/components/apply/question-field'
import { Checkbox, CheckboxGroup, ErrorSummary, Field, RadioGroup } from '@/components/ui/form'
import { Alert, Button } from '@/components/ui/primitives'
import type { FieldErrors } from '@/lib/actions/result'
import type { AnswerMap, AnswerValue, QuestionDef } from '@/lib/questions/engine'
import { visibleQuestions } from '@/lib/questions/engine'
import { SHIFT_PERIODS } from '@/lib/validation/registration'
import { formatDate } from '@/lib/utils'

/**
 * Everything a returning volunteer decides for one edition, in one submission.
 *
 * Department, availability and consents — the three things that are genuinely
 * new each time. Deliberately a single page rather than steps: the wizard's
 * eight steps exist to capture who somebody *is*, and this form is for people
 * we already know.
 */

type Values = {
  departmentId: string
  availableDates: string[]
  preferredPeriods: ('MORNING' | 'AFTERNOON' | 'EVENING' | 'OVERNIGHT')[]
  availableOvernight: boolean | null
}

const LABELS: Record<string, string> = {
  departmentId: 'Department',
  availableDates: 'Dates',
  preferredPeriods: 'Shift periods',
  availableOvernight: 'Overnight availability',
  consentAccurate: 'Accuracy confirmation',
  consentTerms: 'Volunteer terms',
  consentDataProcessing: 'Data processing consent',
  consentCommunication: 'Contact consent',
}

export function ParticipateForm({
  departments,
  initialQuestions,
  eventDates,
  initialValues,
  alreadyConfirmed,
}: {
  departments: { id: string; name: string; description: string | null; applied: number }[]
  /** Questions for the default department, server-rendered to skip a fetch. */
  initialQuestions: QuestionDef[]
  eventDates: string[]
  initialValues: Values
  alreadyConfirmed: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<Values>(initialValues)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [questions, setQuestions] = useState<QuestionDef[]>(initialQuestions)
  const [loadedFor, setLoadedFor] = useState<string | null>(initialValues.departmentId || null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [consents, setConsents] = useState({
    consentAccurate: false,
    consentTerms: false,
    consentDataProcessing: false,
    consentCommunication: false,
  })

  const selectedId = values.departmentId

  // Load the chosen department's questions on demand — same contract as the
  // registration wizard, so a question added in admin appears in both.
  useEffect(() => {
    if (!selectedId || loadedFor === selectedId) return

    const controller = new AbortController()
    fetch(`/api/departments/${selectedId}/questions`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json()
      })
      .then((data: { items: QuestionDef[] }) => {
        setQuestions(data.items)
        setLoadedFor(selectedId)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        console.error('[questions] load failed', cause)
        setLoadError('We could not load the questions for this department. Please try again.')
      })

    return () => controller.abort()
  }, [selectedId, loadedFor])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setFormError(null)

    const payload: ConfirmParticipationInput = {
      departmentId: values.departmentId,
      availableDates: values.availableDates,
      preferredPeriods: values.preferredPeriods,
      availableOvernight: values.availableOvernight as boolean,
      consentAccurate: consents.consentAccurate as true,
      consentTerms: consents.consentTerms as true,
      consentDataProcessing: consents.consentDataProcessing as true,
      consentCommunication: consents.consentCommunication as true,
    }

    startTransition(async () => {
      const result = await confirmParticipationAction(payload, answers)
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setFormError(result.fieldErrors ? null : result.error)
        document.getElementById('participate-errors')?.focus()
        return
      }
      router.replace('/dashboard?confirmed=1')
      router.refresh()
    })
  }

  const summary = Object.entries(errors).map(([field, message]) => ({
    field: `participate-${field}`,
    message: `${LABELS[field.replace(/^answers\./, '')] ?? field}: ${message}`,
  }))

  const shownQuestions = visibleQuestions(questions, answers)

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <div>
        <ErrorSummary id="participate-errors" errors={summary} />
        {formError && (
          <Alert tone="danger" title="Could not confirm your availability">
            {formError}
          </Alert>
        )}
      </div>

      {/* ------------------------------------------------------ department */}
      <Field
        label="Where do you want to serve this edition?"
        required
        error={errors.departmentId}
        help={
          alreadyConfirmed
            ? 'Changing department clears your answers to the previous one.'
            : 'Your previous department is selected — keep it, or serve somewhere new.'
        }
        asFieldset
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {departments.map((department) => {
            const checked = selectedId === department.id
            return (
              <label
                key={department.id}
                className={`flex cursor-pointer items-start gap-3 rounded-card border p-4 transition-colors ${
                  checked ? 'border-primary bg-primary-subtle' : 'border-line-strong hover:border-muted'
                }`}
              >
                <input
                  type="radio"
                  name="departmentId"
                  value={department.id}
                  checked={checked}
                  onChange={() => {
                    setValues((current) => ({ ...current, departmentId: department.id }))
                    // A different department asks different questions.
                    setAnswers({})
                    setQuestions([])
                    setLoadedFor(null)
                    setLoadError(null)
                  }}
                  className="mt-1 size-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span className="min-w-0">
                  <span className="block font-display text-base font-bold uppercase text-ink">
                    {department.name}
                  </span>
                  {department.description && (
                    <span className="mt-1 block text-sm text-muted">{department.description}</span>
                  )}
                  {department.applied > 0 && (
                    <span className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                      <Users aria-hidden className="size-3.5" />
                      {department.applied} {department.applied === 1 ? 'volunteer' : 'volunteers'} so far
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      </Field>

      {selectedId && (
        <section aria-live="polite" className="space-y-6 border-t border-line pt-6">
          <h2 className="text-base">Department questions</h2>
          {loadError && <Alert tone="danger">{loadError}</Alert>}
          {shownQuestions.length === 0 && !loadError && loadedFor === selectedId && (
            <p className="text-sm text-muted">This department has no extra questions.</p>
          )}
          {shownQuestions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={answers[question.key]}
              onChange={(value: AnswerValue) =>
                setAnswers((current) => ({ ...current, [question.key]: value }))
              }
              error={errors[`answers.${question.key}`]}
            />
          ))}
        </section>
      )}

      {/* ---------------------------------------------------- availability */}
      <section className="space-y-6 border-t border-line pt-6">
        <h2 className="text-base">When can you serve?</h2>

        <Field
          label="Which dates can you serve?"
          required
          error={errors.availableDates}
          help="Select every date you are available."
          asFieldset
        >
          {eventDates.length === 0 ? (
            <Alert tone="info">
              Event dates have not been published yet. You can update this later from your dashboard.
            </Alert>
          ) : (
            <CheckboxGroup
              name="availableDates"
              columns={2}
              options={eventDates.map((date) => ({ value: date, label: formatDate(date) }))}
              values={values.availableDates}
              onToggle={(value) =>
                setValues((current) => ({
                  ...current,
                  availableDates: current.availableDates.includes(value)
                    ? current.availableDates.filter((d) => d !== value)
                    : [...current.availableDates, value],
                }))
              }
              invalid={Boolean(errors.availableDates)}
            />
          )}
        </Field>

        <Field
          label="Which shift periods suit you best?"
          required
          error={errors.preferredPeriods}
          asFieldset
        >
          <CheckboxGroup
            name="preferredPeriods"
            columns={2}
            options={SHIFT_PERIODS.map((period) => ({
              value: period.value,
              label: period.label,
              description: period.hint,
            }))}
            values={values.preferredPeriods}
            onToggle={(value) =>
              setValues((current) => ({
                ...current,
                preferredPeriods: current.preferredPeriods.includes(value as never)
                  ? current.preferredPeriods.filter((p) => p !== value)
                  : [...current.preferredPeriods, value as (typeof current.preferredPeriods)[number]],
              }))
            }
            invalid={Boolean(errors.preferredPeriods)}
          />
        </Field>

        <Field
          label="Can you serve overnight?"
          required
          error={errors.availableOvernight}
          help="The marathon runs through the night; overnight volunteers make that possible."
          asFieldset
        >
          <RadioGroup
            name="availableOvernight"
            columns={2}
            options={[
              { value: 'yes', label: 'Yes, I can serve overnight' },
              { value: 'no', label: 'No, daytime only' },
            ]}
            value={
              values.availableOvernight === null ? null : values.availableOvernight ? 'yes' : 'no'
            }
            onChange={(value) =>
              setValues((current) => ({ ...current, availableOvernight: value === 'yes' }))
            }
            invalid={Boolean(errors.availableOvernight)}
          />
        </Field>
      </section>

      {/* -------------------------------------------------------- consents */}
      <section className="space-y-4 border-t border-line pt-6">
        <h2 className="flex items-center gap-2 text-base">
          <ShieldCheck aria-hidden className="size-5 text-primary" />
          This edition&rsquo;s agreements
        </h2>
        <p className="text-sm text-muted">
          Consents are given per edition, so we ask again each time — agreeing for{' '}
          one year is never treated as agreeing for the next.
        </p>

        <Checkbox
          name="consentAccurate"
          checked={consents.consentAccurate}
          onChange={(checked) => setConsents((c) => ({ ...c, consentAccurate: checked }))}
          invalid={Boolean(errors.consentAccurate)}
          label="The information I have given is accurate and up to date."
        />
        <Checkbox
          name="consentTerms"
          checked={consents.consentTerms}
          onChange={(checked) => setConsents((c) => ({ ...c, consentTerms: checked }))}
          invalid={Boolean(errors.consentTerms)}
          label="I agree to the volunteer terms for this edition."
        />
        <Checkbox
          name="consentDataProcessing"
          checked={consents.consentDataProcessing}
          onChange={(checked) => setConsents((c) => ({ ...c, consentDataProcessing: checked }))}
          invalid={Boolean(errors.consentDataProcessing)}
          label="I consent to my details being processed to organise my volunteering."
        />
        <Checkbox
          name="consentCommunication"
          checked={consents.consentCommunication}
          onChange={(checked) => setConsents((c) => ({ ...c, consentCommunication: checked }))}
          invalid={Boolean(errors.consentCommunication)}
          label="The team may contact me about my shifts and service."
        />
      </section>

      <div className="border-t border-line pt-6">
        <Button type="submit" size="lg" isLoading={pending}>
          <CalendarCheck aria-hidden className="size-4" />
          {alreadyConfirmed ? 'Save my changes' : 'Confirm my availability'}
        </Button>
      </div>
    </form>
  )
}
