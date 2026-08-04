'use client'

import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { saveDepartmentAction } from '@/app/(volunteer)/apply/actions'
import { QuestionField } from '@/components/apply/question-field'
import { StepShell } from '@/components/apply/step-shell'
import { useStepForm } from '@/components/apply/use-step-form'
import { Alert, Skeleton } from '@/components/ui/primitives'
import { Field } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { departmentSchema, type DepartmentFormValues } from '@/lib/validation/registration'
import {
  validateAnswers,
  visibleQuestions,
  type AnswerMap,
  type AnswerValue,
  type QuestionDef,
} from '@/lib/questions/engine'

type DepartmentOption = {
  id: string
  slug: string
  name: string
  description: string | null
  capacity: number | null
  applied: number
}

/**
 * Department selection and its conditional questions.
 *
 * Only the selected department's questions are fetched and rendered, and within
 * those, only the ones whose conditions are met — a volunteer never sees a
 * question belonging to another department, or one that depends on an answer
 * they have not given.
 */
export function DepartmentStep({
  initialValues,
  initialAnswers,
  departments,
  initialQuestions,
}: {
  initialValues: DepartmentFormValues
  initialAnswers: AnswerMap
  departments: DepartmentOption[]
  initialQuestions: QuestionDef[]
}) {
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers)
  const [questions, setQuestions] = useState<QuestionDef[]>(initialQuestions)
  const [loadedFor, setLoadedFor] = useState<string | null>(
    initialValues.departmentId && initialQuestions.length > 0 ? initialValues.departmentId : null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)

  const form = useStepForm<DepartmentFormValues>({
    step: 'department',
    initialValues,
    schema: departmentSchema,
    action: (values) => saveDepartmentAction(values, answers),
    nextHref: '/apply/availability',
    extraValidate: () => {
      const errors = validateAnswers(questions, answers)
      const prefixed: Record<string, string> = {}
      for (const [key, message] of Object.entries(errors)) prefixed[`answers.${key}`] = message
      return prefixed
    },
  })

  const selectedId = form.values.departmentId

  // Load the chosen department's questions on demand.
  useEffect(() => {
    // Selecting a department clears the previous questions in the change
    // handler, so there is nothing to reset here.
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

  // Derived rather than stored: a separate loading flag would have to be set
  // synchronously inside the effect above.
  const loadingQuestions = Boolean(selectedId) && loadedFor !== selectedId && !loadError

  const shown = useMemo(() => visibleQuestions(questions, answers), [questions, answers])

  function updateAnswer(key: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [key]: value }))
    form.setErrors((current) => {
      if (!current[`answers.${key}`]) return current
      const next = { ...current }
      delete next[`answers.${key}`]
      return next
    })
  }

  return (
    <StepShell
      stepNumber={5}
      title="Volunteer department"
      description="Choose where you would like to serve. We will then ask a few questions specific to that team."
      errors={form.errors}
      formError={form.formError}
      pending={form.pending}
      saveState={form.saveState}
      onSubmit={form.submit}
      onSaveAndExit={form.saveAndExit}
    >
      <Field label="Preferred department" required error={form.errors.departmentId} asFieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          {departments.map((department) => {
            const checked = selectedId === department.id
            return (
              <label
                key={department.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-card border p-4 transition-colors',
                  checked ? 'border-primary bg-primary-subtle' : 'border-line-strong hover:border-muted',
                )}
              >
                <input
                  type="radio"
                  name="departmentId"
                  value={department.id}
                  checked={checked}
                  onChange={() => {
                    // Switching department discards answers to the previous one.
                    form.setValue('departmentId', department.id)
                    setAnswers({})
                    setQuestions([])
                    setLoadedFor(null)
                    setLoadError(null)
                  }}
                  className="mt-1 size-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-bold uppercase text-ink">{department.name}</span>
                  </span>
                  {department.description && (
                    <span className="mt-1 block text-sm text-muted">{department.description}</span>
                  )}
                  {/*
                    How many have chosen this department — for orientation, not
                    as a limit. There is no fixed number of volunteers a
                    department needs, so nothing here closes one or discourages
                    a choice.
                  */}
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
          <h3 className="text-base">Department questions</h3>

          {loadError && <Alert tone="danger">{loadError}</Alert>}

          {loadingQuestions && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-11 w-full" />
            </div>
          )}

          {!loadingQuestions && !loadError && shown.length === 0 && (
            <p className="text-sm text-muted">This department has no additional questions.</p>
          )}

          {!loadingQuestions &&
            shown.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                value={answers[question.key]}
                onChange={(value) => updateAnswer(question.key, value)}
                error={form.errors[`answers.${question.key}`]}
              />
            ))}
        </section>
      )}
    </StepShell>
  )
}
