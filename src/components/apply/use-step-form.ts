'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { z } from 'zod'
import { autosaveStepAction } from '@/app/(volunteer)/apply/actions'
import type { ActionResult, FieldErrors } from '@/lib/actions/result'
import type { WizardStepSlug } from '@/lib/validation/registration'

/**
 * Shared behaviour for every wizard step.
 *
 * Responsibilities:
 *  - hold the step's values and field errors
 *  - autosave the draft after a pause in typing, and on tab hide / unmount
 *  - validate on the client, then submit to the step's Server Action
 *  - warn before leaving with unsaved edits
 *  - move focus to the error summary when validation fails
 *
 * A failed save never clears the form: values stay exactly as typed so the
 * volunteer can retry after a network failure.
 */
const AUTOSAVE_DEBOUNCE_MS = 1500

export type StepFormOptions<TValues> = {
  step: WizardStepSlug
  initialValues: TValues
  schema: z.ZodType<unknown, TValues> | z.ZodType
  action: (values: TValues) => Promise<ActionResult<unknown>>
  nextHref: string
  /** Extra client-side checks that the schema cannot express. */
  extraValidate?: (values: TValues) => FieldErrors
  /**
   * Derive computed fields before validation and submission — e.g. combining a
   * dialling code and a local number into one E.164 value. Applied in both
   * places so the browser validates exactly what the server will receive.
   */
  prepare?: (values: TValues) => TValues
}

export function useStepForm<TValues extends Record<string, unknown>>({
  step,
  initialValues,
  schema,
  action,
  nextHref,
  extraValidate,
  prepare,
}: StepFormOptions<TValues>) {
  const router = useRouter()
  const [values, setValues] = useState<TValues>(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const dirtyRef = useRef(false)
  const valuesRef = useRef(values)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Mirror the latest values into a ref so the unmount and tab-hide handlers can
  // save them. Written in an effect rather than during render, which React
  // treats as a side effect.
  useEffect(() => {
    valuesRef.current = values
  }, [values])

  const flush = useCallback(async () => {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    setSaveState('saving')
    const result = await autosaveStepAction(step, valuesRef.current).catch(() => null)
    setSaveState(result?.ok ? 'saved' : 'error')
  }, [step])

  // Debounced autosave.
  useEffect(() => {
    if (!dirtyRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void flush(), AUTOSAVE_DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [values, flush])

  // Save when the tab is hidden — covers closing the tab and switching apps on mobile.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void flush()
    }
  }, [flush])

  // Confirm before abandoning an incomplete step.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const setValue = useCallback(<K extends keyof TValues>(key: K, value: TValues[K]) => {
    dirtyRef.current = true
    setSaveState('idle')
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key as string]) return current
      const next = { ...current }
      delete next[key as string]
      return next
    })
  }, [])

  /**
   * Toggle a value inside an array field using a functional update, so several
   * toggles dispatched in one React batch all survive.
   */
  const toggleInArray = useCallback((key: keyof TValues, value: string) => {
    dirtyRef.current = true
    setSaveState('idle')
    setValues((current) => {
      const list = (current[key] as unknown as string[] | undefined) ?? []
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      return { ...current, [key]: next }
    })
    setErrors((current) => {
      if (!current[key as string]) return current
      const next = { ...current }
      delete next[key as string]
      return next
    })
  }, [])

  const patch = useCallback((partial: Partial<TValues>) => {
    dirtyRef.current = true
    setSaveState('idle')
    setValues((current) => ({ ...current, ...partial }))
  }, [])

  const submit = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault()
      setFormError(null)

      const prepared = prepare ? prepare(values) : values
      const parsed = schema.safeParse(prepared)
      const fieldErrors: FieldErrors = {}

      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = issue.path.join('.') || '_form'
          if (!fieldErrors[key]) fieldErrors[key] = issue.message
        }
      }

      Object.assign(fieldErrors, extraValidate?.(prepared) ?? {})

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
        requestAnimationFrame(() => document.getElementById('step-errors')?.focus())
        return
      }

      setErrors({})
      startTransition(async () => {
        try {
          const result = await action(prepared)
          if (!result.ok) {
            setErrors(result.fieldErrors ?? {})
            setFormError(result.fieldErrors ? null : result.error)
            requestAnimationFrame(() => document.getElementById('step-errors')?.focus())
            return
          }
          dirtyRef.current = false
          router.push(nextHref)
          router.refresh()
        } catch {
          // Network or server failure — keep every value the volunteer typed.
          setFormError('We could not save your answers. Check your connection and try again.')
          requestAnimationFrame(() => document.getElementById('step-errors')?.focus())
        }
      })
    },
    [action, extraValidate, nextHref, prepare, router, schema, values],
  )

  const saveAndExit = useCallback(() => {
    startTransition(async () => {
      await flush()
      router.push('/dashboard?saved=1')
    })
  }, [flush, router])

  return {
    values,
    setValue,
    patch,
    toggleInArray,
    errors,
    setErrors,
    formError,
    pending,
    saveState,
    submit,
    saveAndExit,
  }
}
