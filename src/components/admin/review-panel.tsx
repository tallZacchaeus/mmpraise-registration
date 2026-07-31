'use client'

import { useState, useTransition } from 'react'
import { Eye, HeartPulse, Lock, MessageSquarePlus, Send } from 'lucide-react'
import {
  addNoteAction,
  changeStatusAction,
  revealHealthInfoAction,
} from '@/app/(admin)/admin/actions'
import { Alert, Button, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { Checkbox, Field, SelectInput, TextArea } from '@/components/ui/form'
import { STATUS_LABELS } from '@/lib/applications/status'
import type { ApplicationStatus } from '@/generated/prisma/enums'

const TRANSITIONS: ApplicationStatus[] = [
  'UNDER_REVIEW',
  'APPROVED',
  'WAITLISTED',
  'REJECTED',
  'ASSIGNED',
  'CHECKED_IN',
  'COMPLETED',
]

export function StatusPanel({
  applicationId,
  currentStatus,
  canDecide,
}: {
  applicationId: string
  currentStatus: ApplicationStatus
  canDecide: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<ApplicationStatus>(currentStatus)
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const decisionStatuses: ApplicationStatus[] = ['APPROVED', 'REJECTED', 'WAITLISTED']
  const needsReason = status === 'REJECTED'

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await changeStatusAction({ applicationId, status, reason, notify })
      setMessage(
        result.ok
          ? { tone: 'success', text: `Status changed to ${STATUS_LABELS[status]}.` }
          : { tone: 'danger', text: result.error },
      )
      if (result.ok) setReason('')
    })
  }

  return (
    <Card>
      <CardHeader title="Review decision" description={`Currently ${STATUS_LABELS[currentStatus]}.`} />
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          {message && <Alert tone={message.tone}>{message.text}</Alert>}

          <Field label="Set status" htmlFor="review-status" required>
            <SelectInput
              id="review-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ApplicationStatus)}
            >
              {TRANSITIONS.map((value) => (
                <option
                  key={value}
                  value={value}
                  disabled={!canDecide && decisionStatuses.includes(value)}
                >
                  {STATUS_LABELS[value]}
                  {!canDecide && decisionStatuses.includes(value) ? ' (not permitted)' : ''}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field
            label="Message to the volunteer"
            htmlFor="review-reason"
            required={needsReason}
            help="Included in the status email and shown on their dashboard."
          >
            <TextArea
              id="review-reason"
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>

          <Checkbox
            checked={notify}
            onChange={setNotify}
            label="Email the volunteer about this change"
            description="Health information is never included in these emails."
          />

          <Button type="submit" isLoading={pending}>
            {!pending && <Send aria-hidden className="size-4" />}
            Save decision
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

export function NotesPanel({
  applicationId,
  notes,
}: {
  applicationId: string
  notes: { id: string; body: string; createdAt: string; author: string }[]
}) {
  const [pending, startTransition] = useTransition()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await addNoteAction({ applicationId, body })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setBody('')
    })
  }

  return (
    <Card>
      <CardHeader title="Internal notes" description="Visible to administrators only — never to the volunteer." />
      <CardBody className="space-y-5">
        <form onSubmit={submit} className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Add a note" htmlFor="note-body">
            <TextArea
              id="note-body"
              maxLength={2000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Interview notes, follow-ups, references checked…"
            />
          </Field>
          <Button type="submit" size="sm" isLoading={pending} disabled={body.trim().length < 2}>
            {!pending && <MessageSquarePlus aria-hidden className="size-4" />}
            Add note
          </Button>
        </form>

        {notes.length > 0 && (
          <ul className="space-y-3 border-t border-line pt-4">
            {notes.map((note) => (
              <li key={note.id}>
                <p className="text-xs text-muted">
                  {note.author} · {note.createdAt}
                </p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-body">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

/**
 * Health information is not rendered with the page — it is fetched only when an
 * authorised officer explicitly asks for it, and that request is audited.
 */
export function HealthPanel({ applicationId, canView }: { applicationId: string; canView: boolean }) {
  const [pending, startTransition] = useTransition()
  const [data, setData] = useState<{ hasCondition: boolean; details: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!canView) {
    return (
      <Card>
        <CardHeader title="Health information" />
        <CardBody>
          <Alert tone="info" icon={<Lock className="size-5" />}>
            Restricted. Only the Medical Information Officer and Super Administrators can view declared
            health information.
          </Alert>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader title="Health information" description="Access is recorded in the audit log." />
      <CardBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {data ? (
          data.hasCondition ? (
            <Alert tone="warning" title="Condition declared" icon={<HeartPulse className="size-5" />}>
              <p className="whitespace-pre-line">{data.details ?? 'No further detail was given.'}</p>
            </Alert>
          ) : (
            <Alert tone="success">No medical condition was declared.</Alert>
          )
        ) : (
          <Button
            type="button"
            variant="secondary"
            isLoading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await revealHealthInfoAction(applicationId)
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                setData(result.data)
              })
            }
          >
            {!pending && <Eye aria-hidden className="size-4" />}
            Reveal health information
          </Button>
        )}
      </CardBody>
    </Card>
  )
}
