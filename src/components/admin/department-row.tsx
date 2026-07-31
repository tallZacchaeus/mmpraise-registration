'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { updateDepartmentAction } from '@/app/(admin)/admin/actions'
import { Button } from '@/components/ui/primitives'
import { TextInput } from '@/components/ui/form'

/** Inline capacity and availability control for one department. */
export function DepartmentRow({
  departmentId,
  capacity,
  isActive,
}: {
  departmentId: string
  capacity: number | null
  isActive: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(capacity === null ? '' : String(capacity))
  const [active, setActive] = useState(isActive)
  const [saved, setSaved] = useState(false)

  function save() {
    setSaved(false)
    startTransition(async () => {
      const result = await updateDepartmentAction({
        departmentId,
        capacity: value.trim() === '' ? null : Number(value),
        isActive: active,
      })
      if (result.ok) setSaved(true)
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`capacity-${departmentId}`} className="mb-1 block text-xs font-semibold text-ink">
          Capacity
        </label>
        <TextInput
          id={`capacity-${departmentId}`}
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="No limit"
          className="w-28"
        />
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm text-body">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="size-5 accent-[var(--color-primary)]"
        />
        Open
      </label>

      <Button type="button" size="sm" variant="secondary" isLoading={pending} onClick={save}>
        {saved && !pending ? <Check aria-hidden className="size-4 text-success" /> : null}
        {saved && !pending ? 'Saved' : 'Save'}
      </Button>
    </div>
  )
}
