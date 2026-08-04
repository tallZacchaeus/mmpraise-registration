'use client'

import { useState, useTransition } from 'react'
import { Check, Inbox, PlayCircle } from 'lucide-react'
import { triageContactMessageAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Field, TextInput } from '@/components/ui/form'
import type { ContactStatus } from '@/generated/prisma/enums'

/** Move a contact message through triage. */
export function ContactMessageActions({ id, status }: { id: string; status: ContactStatus }) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function triage(next: ContactStatus) {
    setError(null)
    startTransition(async () => {
      const result = await triageContactMessageAction({ id, status: next, note })
      if (!result.ok) setError(result.error)
      else setNote('')
    })
  }

  return (
    <div className="space-y-3 border-t border-line pt-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <Field
        label="Internal note"
        htmlFor={`contact-note-${id}`}
        help="Internal only — never sent to the person who wrote in."
      >
        <TextInput
          id={`contact-note-${id}`}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        {status !== 'IN_PROGRESS' && (
          <Button type="button" size="sm" isLoading={pending} onClick={() => triage('IN_PROGRESS')}>
            <PlayCircle aria-hidden className="size-4" />
            Mark in progress
          </Button>
        )}
        {status !== 'RESOLVED' && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={pending}
            onClick={() => triage('RESOLVED')}
          >
            <Check aria-hidden className="size-4" />
            Mark resolved
          </Button>
        )}
        {status !== 'NEW' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            isLoading={pending}
            onClick={() => triage('NEW')}
          >
            <Inbox aria-hidden className="size-4" />
            Move back to new
          </Button>
        )}
      </div>
    </div>
  )
}
