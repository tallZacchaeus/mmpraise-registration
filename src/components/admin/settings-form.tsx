'use client'

import { useState, useTransition } from 'react'
import { Save } from 'lucide-react'
import { updateSettingsAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Checkbox, Field, TextArea, TextInput } from '@/components/ui/form'
import type { SettingsMap } from '@/lib/settings'
import type { FieldErrors } from '@/lib/actions/result'

export function SettingsForm({ settings }: { settings: SettingsMap }) {
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState({
    registration_open: settings.registration_open,
    registration_closed_message: settings.registration_closed_message,
    event_name: settings.event_name,
    event_dates: settings.event_dates.join('\n'),
    support_email: settings.support_email,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const result = await updateSettingsAction({
        ...values,
        event_dates: values.event_dates
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      })

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setMessage({ tone: 'danger', text: result.error })
        return
      }
      setErrors({})
      setMessage({ tone: 'success', text: 'Settings saved.' })
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Checkbox
        checked={values.registration_open}
        onChange={(checked) => setValues((v) => ({ ...v, registration_open: checked }))}
        label="Registration is open"
        description="When switched off, new registrations are blocked and the message below is shown instead."
      />

      <Field
        label="Message shown when registration is closed"
        htmlFor="settings-closed-message"
        error={errors.registration_closed_message}
      >
        <TextArea
          id="settings-closed-message"
          maxLength={500}
          value={values.registration_closed_message}
          onChange={(event) => setValues((v) => ({ ...v, registration_closed_message: event.target.value }))}
        />
      </Field>

      <Field label="Event name" htmlFor="settings-event-name" required error={errors.event_name}>
        <TextInput
          id="settings-event-name"
          value={values.event_name}
          onChange={(event) => setValues((v) => ({ ...v, event_name: event.target.value }))}
        />
      </Field>

      <Field
        label="Event dates"
        htmlFor="settings-event-dates"
        error={errors.event_dates}
        help="One date per line in YYYY-MM-DD format. These become the availability options in the wizard."
      >
        <TextArea
          id="settings-event-dates"
          value={values.event_dates}
          onChange={(event) => setValues((v) => ({ ...v, event_dates: event.target.value }))}
          className="font-mono"
        />
      </Field>

      <Field label="Support email address" htmlFor="settings-support-email" required error={errors.support_email}>
        <TextInput
          id="settings-support-email"
          type="email"
          value={values.support_email}
          onChange={(event) => setValues((v) => ({ ...v, support_email: event.target.value }))}
        />
      </Field>

      <Button type="submit" isLoading={pending}>
        {!pending && <Save aria-hidden className="size-4" />}
        Save settings
      </Button>
    </form>
  )
}
