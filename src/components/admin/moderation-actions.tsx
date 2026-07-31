'use client'

import { useState, useTransition } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import { moderateTestimonyAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Field, TextInput } from '@/components/ui/form'
import type { SubmissionStatus } from '@/generated/prisma/enums'

/** Approve, decline or reopen a submitted testimony. */
export function ModerationActions({ id, status }: { id: string; status: SubmissionStatus }) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function moderate(next: SubmissionStatus) {
    setError(null)
    startTransition(async () => {
      const result = await moderateTestimonyAction({ id, status: next, note })
      if (!result.ok) setError(result.error)
      else setNote('')
    })
  }

  return (
    <div className="space-y-3 border-t border-line pt-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <Field
        label="Review note"
        htmlFor={`note-${id}`}
        help="Internal only — never shown to the person who submitted it."
      >
        <TextInput
          id={`note-${id}`}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        {status !== 'APPROVED' && (
          <Button type="button" size="sm" isLoading={pending} onClick={() => moderate('APPROVED')}>
            <Check aria-hidden className="size-4" />
            Approve for publication
          </Button>
        )}
        {status !== 'REJECTED' && (
          <Button type="button" variant="secondary" size="sm" isLoading={pending} onClick={() => moderate('REJECTED')}>
            <X aria-hidden className="size-4" />
            Do not publish
          </Button>
        )}
        {status !== 'PENDING' && (
          <Button type="button" variant="ghost" size="sm" isLoading={pending} onClick={() => moderate('PENDING')}>
            <RotateCcw aria-hidden className="size-4" />
            Move back to review
          </Button>
        )}
      </div>
    </div>
  )
}
