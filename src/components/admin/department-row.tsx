'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Check, Pencil, X } from 'lucide-react'
import { reorderDepartmentAction, updateDepartmentAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Field, TextArea, TextInput } from '@/components/ui/form'
import type { FieldErrors } from '@/lib/actions/result'

/**
 * Open or close one department, rename it, describe it, and move it in the
 * order volunteers see.
 *
 * Deliberately no capacity. There is no fixed number of volunteers a
 * department needs, so there is no limit to set — the control that used to
 * live here quietly turned "no limit" into a rule the organisation does not
 * have, and blocked real volunteers at submission.
 */
export function DepartmentRow({
  departmentId,
  name,
  description,
  isActive,
  isFirst,
  isLast,
}: {
  departmentId: string
  name: string
  description: string | null
  isActive: boolean
  isFirst: boolean
  isLast: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({ name, description: description ?? '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  /*
   * The checkbox answers to local state, not straight to the server prop.
   * Bound to the prop alone it visibly snapped back to its old position for
   * the whole round trip, which reads as "that didn't work". It is corrected
   * from the server on failure.
   */
  const [open, setOpen] = useState(isActive)

  function toggleOpen(nextActive: boolean) {
    setError(null)
    setSaved(false)
    setOpen(nextActive)
    startTransition(async () => {
      const result = await updateDepartmentAction({ departmentId, isActive: nextActive })
      if (!result.ok) {
        setOpen(!nextActive)
        setError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  function saveDetails(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setErrors({})
    startTransition(async () => {
      const result = await updateDepartmentAction({
        departmentId,
        isActive: open,
        name: values.name,
        description: values.description,
      })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setError(result.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  function move(direction: 'up' | 'down') {
    setError(null)
    startTransition(async () => {
      const result = await reorderDepartmentAction(departmentId, direction)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  if (editing) {
    return (
      <form onSubmit={saveDetails} className="w-full space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Name" htmlFor={`dept-name-${departmentId}`} required error={errors.name}>
          <TextInput
            id={`dept-name-${departmentId}`}
            maxLength={80}
            value={values.name}
            onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
            invalid={Boolean(errors.name)}
          />
        </Field>
        <Field
          label="Description"
          htmlFor={`dept-description-${departmentId}`}
          help="Shown to volunteers when they choose a department."
          error={errors.description}
        >
          <TextArea
            id={`dept-description-${departmentId}`}
            rows={2}
            maxLength={500}
            value={values.description}
            onChange={(event) => setValues((v) => ({ ...v, description: event.target.value }))}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="sm" isLoading={pending}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setValues({ name, description: description ?? '' })
              setErrors({})
              setError(null)
              setEditing(false)
            }}
          >
            <X aria-hidden className="size-4" />
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {error && (
        <Alert tone="danger" className="w-full">
          {error}
        </Alert>
      )}

      <label className="flex min-h-11 items-center gap-2 text-sm text-body">
        <input
          type="checkbox"
          checked={open}
          onChange={(event) => toggleOpen(event.target.checked)}
          className="size-5 accent-[var(--color-primary)]"
        />
        Open for applications
        {saved && !pending && <Check aria-hidden className="size-4 text-success" />}
      </label>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        isLoading={pending}
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden className="size-4" />
        Edit
      </Button>

      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isFirst || pending}
          onClick={() => move('up')}
          aria-label={`Move ${name} up`}
        >
          <ArrowUp aria-hidden className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isLast || pending}
          onClick={() => move('down')}
          aria-label={`Move ${name} down`}
        >
          <ArrowDown aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  )
}
