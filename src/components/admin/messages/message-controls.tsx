'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, ShieldAlert, UserCheck } from 'lucide-react'
import {
  assignContactMessageAction,
  setContactControlsAction,
} from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import type { ContactPriority } from '@/generated/prisma/enums'

const PRIORITIES: { value: ContactPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

/**
 * Assignment, priority and tagging for one message.
 *
 * Priority is decided by the person triaging, never inferred from the text —
 * "URGENT!!!" in a subject line is information about the sender, not the
 * situation. Assignment stays advisory, exactly as it is for testimonies.
 */
export function MessageControls({
  id,
  priority,
  isSpam,
  isTestData,
  assignedToMe,
  assignedToName,
}: {
  id: string
  priority: ContactPriority
  isSpam: boolean
  isTestData: boolean
  assignedToMe: boolean
  assignedToName: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error ?? 'That did not work')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {error && (
        <Alert tone="danger" className="w-full">
          {error}
        </Alert>
      )}

      <label className="flex items-center gap-2 text-sm text-body">
        <span className="font-semibold text-ink">Priority</span>
        <select
          value={priority}
          disabled={pending}
          onChange={(event) =>
            run(() => setContactControlsAction({ id, priority: event.target.value as ContactPriority }))
          }
          className="min-h-11 rounded-field border border-line-strong bg-surface px-3 py-1.5 text-sm"
        >
          {PRIORITIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <Button
        variant="outline"
        size="sm"
        isLoading={pending}
        onClick={() => run(() => assignContactMessageAction(id, !assignedToMe))}
      >
        <UserCheck aria-hidden className="size-4" />
        {assignedToMe ? 'Hand back' : 'Take this one'}
      </Button>
      {assignedToName && !assignedToMe && (
        <span className="text-sm text-muted">{assignedToName} has it.</span>
      )}

      <Button
        variant="outline"
        size="sm"
        isLoading={pending}
        onClick={() => run(() => setContactControlsAction({ id, isSpam: !isSpam }))}
      >
        <ShieldAlert aria-hidden className="size-4" />
        {isSpam ? 'Not spam' : 'Mark as spam'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        isLoading={pending}
        onClick={() => run(() => setContactControlsAction({ id, isTestData: !isTestData }))}
      >
        <Bug aria-hidden className="size-4" />
        {isTestData ? 'Not test data' : 'Tag as test data'}
      </Button>
    </div>
  )
}
