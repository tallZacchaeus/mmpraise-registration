'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { saveAnnouncementAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Checkbox, Field, SelectInput, TextArea, TextInput } from '@/components/ui/form'
import type { FieldErrors } from '@/lib/actions/result'

export type EditableAnnouncement = {
  id: string
  title: string
  body: string
  audience: string
  departmentId: string | null
  priority: string
  showOnDashboard: boolean
  showAsBanner: boolean
  emailSubject: string | null
  /** `datetime-local` format, already in the server's timezone. */
  expiresAt: string | null
}

/**
 * The announcement editor — used bare on `/new` and prefilled on the detail
 * page. Content and audience only; *when* it is live belongs to the lifecycle
 * controls, so a content edit can never accidentally publish.
 */
export function AnnouncementEditor({
  announcement,
  departments,
  canEmail,
  restrictedToDepartments,
}: {
  announcement: EditableAnnouncement | null
  departments: { id: string; name: string }[]
  canEmail: boolean
  restrictedToDepartments: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState(() => ({
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    audience: announcement?.audience ?? (restrictedToDepartments ? 'DEPARTMENT' : 'ALL_VOLUNTEERS'),
    departmentId: announcement?.departmentId ?? departments[0]?.id ?? '',
    priority: announcement?.priority ?? 'NORMAL',
    showOnDashboard: announcement?.showOnDashboard ?? true,
    showAsBanner: announcement?.showAsBanner ?? false,
    emailSubject: announcement?.emailSubject ?? '',
    expiresAt: announcement?.expiresAt ?? '',
  }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const result = await saveAnnouncementAction({ ...values, id: announcement?.id })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setMessage({ tone: 'danger', text: result.error })
        return
      }
      setErrors({})
      if (!announcement) {
        // A fresh draft gets its own page, where the lifecycle controls live.
        router.push(`/admin/announcements/${result.data.id}`)
        return
      }
      setMessage({ tone: 'success', text: 'Saved. Volunteers see the new wording immediately.' })
      router.refresh()
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
          rows={6}
          maxLength={4000}
          value={values.body}
          onChange={(event) => setValues((v) => ({ ...v, body: event.target.value }))}
          invalid={Boolean(errors.body)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
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

        <Field label="Priority" htmlFor="announcement-priority" required>
          <SelectInput
            id="announcement-priority"
            value={values.priority}
            onChange={(event) => setValues((v) => ({ ...v, priority: event.target.value }))}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </SelectInput>
        </Field>
      </div>

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

      <Field
        label="Stops showing after"
        htmlFor="announcement-expires"
        error={errors.expiresAt}
        help="Leave empty to keep it up until somebody takes it down."
      >
        <TextInput
          id="announcement-expires"
          type="datetime-local"
          value={values.expiresAt}
          onChange={(event) => setValues((v) => ({ ...v, expiresAt: event.target.value }))}
          invalid={Boolean(errors.expiresAt)}
        />
      </Field>

      <div className="space-y-2">
        <Checkbox
          checked={values.showOnDashboard}
          onChange={(checked) => setValues((v) => ({ ...v, showOnDashboard: checked }))}
          label="Show on volunteer dashboards"
        />
        <Checkbox
          checked={values.showAsBanner}
          onChange={(checked) => setValues((v) => ({ ...v, showAsBanner: checked }))}
          label="Highlight it"
          description="Shown emphasised at the top of the announcements list."
        />
      </div>

      {canEmail && (
        <Field
          label="Email subject"
          htmlFor="announcement-email-subject"
          help="Used when this announcement is emailed. Empty means the standard subject."
        >
          <TextInput
            id="announcement-email-subject"
            maxLength={150}
            value={values.emailSubject}
            onChange={(event) => setValues((v) => ({ ...v, emailSubject: event.target.value }))}
          />
        </Field>
      )}

      <Button type="submit" isLoading={pending}>
        {!pending && <Save aria-hidden className="size-4" />}
        {announcement ? 'Save changes' : 'Save draft'}
      </Button>
    </form>
  )
}
