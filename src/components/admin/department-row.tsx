'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { updateDepartmentAction } from '@/app/(admin)/admin/actions'
import { Button } from '@/components/ui/primitives'

/**
 * Open or close one department.
 *
 * Deliberately nothing else. There is no fixed number of volunteers a
 * department needs, so there is no capacity to set — the control that used to
 * live here quietly turned "no limit" into a rule the organisation does not
 * have, and blocked real volunteers at submission.
 */
export function DepartmentRow({
  departmentId,
  isActive,
}: {
  departmentId: string
  isActive: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [active, setActive] = useState(isActive)
  const [saved, setSaved] = useState(false)

  function save() {
    setSaved(false)
    startTransition(async () => {
      const result = await updateDepartmentAction({ departmentId, isActive: active })
      if (result.ok) setSaved(true)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-h-11 items-center gap-2 text-sm text-body">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="size-5 accent-[var(--color-primary)]"
        />
        Open for applications
      </label>

      <Button type="button" size="sm" variant="secondary" isLoading={pending} onClick={save}>
        {saved && !pending ? <Check aria-hidden className="size-4 text-success" /> : null}
        {saved && !pending ? 'Saved' : 'Save'}
      </Button>
    </div>
  )
}
