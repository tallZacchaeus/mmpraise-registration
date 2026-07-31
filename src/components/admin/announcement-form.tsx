'use client'

import { useState, useTransition } from 'react'
import { Megaphone } from 'lucide-react'
import { createAnnouncementAction, toggleAnnouncementAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Checkbox, Field, SelectInput, TextArea, TextInput } from '@/components/ui/form'
import type { FieldErrors } from '@/lib/actions/result'

export function AnnouncementForm({
  departments,
  canEmail,
  restrictedToDepartments,
}: {
  departments: { id: string; name: string }[]
  canEmail: boolean
  restrictedToDepartments: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState({
    title: '',
    body: '',
    audience: restrictedToDepartments ? 'DEPARTMENT' : 'ALL_VOLUNTEERS',
    departmentId: departments[0]?.id ?? '',
    publish: true,
    sendEmail: false,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const result = await createAnnouncementAction(values)
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setMessage({ tone: 'danger', text: result.error })
        return
      }
      setErrors({})
      setValues((v) => ({ ...v, title: '', body: '' }))
      setMessage({
        tone: 'success',
        text: result.data.recipients
          ? `Announcement published and emailed to ${result.data.recipients} volunteer${result.data.recipients === 1 ? '' : 's'}.`
          : 'Announcement saved.',
      })
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Field label="Title" htmlFor="announcement-title" required error={errors.title}>
        <TextInput
          id="announcement-title"
          maxLength={120}
          value={values.title}
          onChange={(event) => setValues((v) => ({ ...v, title: event.target.value }))}
          invalid={Boolean(errors.title)}
        />
      </Field>

      <Field label="Message" htmlFor="announcement-body" required error={errors.body}>
        <TextArea
          id="announcement-body"
          maxLength={4000}
          value={values.body}
          onChange={(event) => setValues((v) => ({ ...v, body: event.target.value }))}
          invalid={Boolean(errors.body)}
        />
      </Field>

      <Field label="Audience" htmlFor="announcement-audience" required>
        <SelectInput
          id="announcement-audience"
          value={values.audience}
          onChange={(event) => setValues((v) => ({ ...v, audience: event.target.value }))}
          disabled={restrictedToDepartments}
        >
          {!restrictedToDepartments && <option value="ALL_VOLUNTEERS">All volunteers</option>}
          <option value="DEPARTMENT">One department</option>
          {!restrictedToDepartments && <option value="APPROVED_ONLY">Approved volunteers only</option>}
        </SelectInput>
      </Field>

      {values.audience === 'DEPARTMENT' && (
        <Field label="Department" htmlFor="announcement-department" required error={errors.departmentId}>
          <SelectInput
            id="announcement-department"
            value={values.departmentId}
            onChange={(event) => setValues((v) => ({ ...v, departmentId: event.target.value }))}
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      <div className="space-y-2">
        <Checkbox
          checked={values.publish}
          onChange={(checked) => setValues((v) => ({ ...v, publish: checked }))}
          label="Publish immediately"
          description="Unpublished announcements are saved as drafts and are not visible to volunteers."
        />

        {canEmail && (
          <Checkbox
            checked={values.sendEmail}
            onChange={(checked) => setValues((v) => ({ ...v, sendEmail: checked }))}
            label="Also email this to the audience"
            description="Sends one email per volunteer. Use sparingly."
          />
        )}
      </div>

      <Button type="submit" isLoading={pending}>
        {!pending && <Megaphone aria-hidden className="size-4" />}
        Save announcement
      </Button>
    </form>
  )
}

export function TogglePublish({ id, published }: { id: string; published: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      isLoading={pending}
      onClick={() => startTransition(async () => void (await toggleAnnouncementAction(id, !published)))}
    >
      {published ? 'Unpublish' : 'Publish'}
    </Button>
  )
}
