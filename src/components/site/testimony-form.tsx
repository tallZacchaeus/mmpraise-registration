'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Send, ShieldCheck } from 'lucide-react'
import { submitTestimonyAction } from '@/app/(site)/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Checkbox, ErrorSummary, Field, TextArea, TextInput } from '@/components/ui/form'
import type { FieldErrors } from '@/lib/actions/result'

/**
 * Testimony submission.
 *
 * Rebuilt from the current Contact Form 7 embed, which uses placeholder text in
 * place of labels, marks nothing as required and gives no accessible feedback.
 * Every field here has a visible label, required fields are marked in text as
 * well as with an asterisk, and errors are summarised, linked and announced.
 */
type Values = {
  title: string
  body: string
  authorName: string
  email: string
  phone: string
  country: string
  isAnonymous: boolean
  consentToPublish: boolean
  website: string
}

const EMPTY: Values = {
  title: '',
  body: '',
  authorName: '',
  email: '',
  phone: '',
  country: '',
  isAnonymous: false,
  consentToPublish: false,
  website: '',
}

const LABELS: Record<string, string> = {
  title: 'Testimony title',
  body: 'Your testimony',
  authorName: 'Full name',
  email: 'Email address',
  country: 'Country',
  consentToPublish: 'Permission to publish',
}

export function TestimonyForm() {
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [pending, startTransition] = useTransition()

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    startTransition(async () => {
      try {
        const result = await submitTestimonyAction(values)
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {})
          setFormError(result.fieldErrors ? null : result.error)
          requestAnimationFrame(() => document.getElementById('testimony-errors')?.focus())
          return
        }
        setValues(EMPTY)
        setErrors({})
        setSubmitted(true)
      } catch {
        setFormError('We could not send your testimony. Please check your connection and try again.')
      }
    })
  }

  if (submitted) {
    return (
      <Alert tone="success" title="Thank you — we have received your testimony" icon={<CheckCircle2 className="size-5" />}>
        Our team reads every submission before it is published, so it may be a little while before you see
        it on the site. If we need to check anything with you, we will use the email address you gave us.
      </Alert>
    )
  }

  const summary = Object.entries(errors).map(([field, message]) => ({
    field: `testimony-${field}`,
    message: `${LABELS[field] ?? field}: ${message}`,
  }))

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ErrorSummary id="testimony-errors" errors={summary} />
      {formError && (
        <Alert tone="danger" title="Your testimony was not sent">
          {formError}
        </Alert>
      )}

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden className="hidden">
        <label htmlFor="testimony-website">Leave this field empty</label>
        <input
          id="testimony-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(event) => set('website', event.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="testimony-authorName" required error={errors.authorName}>
          <TextInput
            id="testimony-authorName"
            autoComplete="name"
            value={values.authorName}
            onChange={(event) => set('authorName', event.target.value)}
            invalid={Boolean(errors.authorName)}
          />
        </Field>

        <Field label="Country" htmlFor="testimony-country" required error={errors.country}>
          <TextInput
            id="testimony-country"
            autoComplete="country-name"
            value={values.country}
            onChange={(event) => set('country', event.target.value)}
            invalid={Boolean(errors.country)}
          />
        </Field>

        <Field
          label="Email address"
          htmlFor="testimony-email"
          required
          error={errors.email}
          help="Used only if we need to verify your testimony. It is never published."
        >
          <TextInput
            id="testimony-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => set('email', event.target.value)}
            invalid={Boolean(errors.email)}
          />
        </Field>

        <Field label="Phone number" htmlFor="testimony-phone" error={errors.phone}>
          <TextInput
            id="testimony-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(event) => set('phone', event.target.value)}
            invalid={Boolean(errors.phone)}
          />
        </Field>
      </div>

      <Field label="Testimony title" htmlFor="testimony-title" error={errors.title} help="A short heading, for example “A life restored”.">
        <TextInput
          id="testimony-title"
          maxLength={120}
          value={values.title}
          onChange={(event) => set('title', event.target.value)}
          invalid={Boolean(errors.title)}
        />
      </Field>

      <Field label="Your testimony" htmlFor="testimony-body" required error={errors.body}>
        <TextArea
          id="testimony-body"
          maxLength={4000}
          className="min-h-40"
          value={values.body}
          onChange={(event) => set('body', event.target.value)}
          invalid={Boolean(errors.body)}
        />
      </Field>

      <div className="space-y-2">
        <Checkbox
          checked={values.isAnonymous}
          onChange={(checked) => set('isAnonymous', checked)}
          label="Publish this anonymously"
          description="We will show your country but not your name."
        />

        <div id="testimony-consentToPublish">
          <Checkbox
            checked={values.consentToPublish}
            onChange={(checked) => set('consentToPublish', checked)}
            invalid={Boolean(errors.consentToPublish)}
            label="I give MMPraise permission to publish this testimony."
            description="Required. You can ask us to remove it at any time."
          />
          {errors.consentToPublish && (
            <p className="mt-1 text-sm font-medium text-danger">{errors.consentToPublish}</p>
          )}
        </div>
      </div>

      <Alert tone="info" icon={<ShieldCheck className="size-5" />}>
        Every testimony is read by our team before it appears on the site. We store your details securely
        and never sell them — see our{' '}
        <Link href="/privacy" className="font-semibold underline underline-offset-4">
          privacy notice
        </Link>
        .
      </Alert>

      <Button type="submit" size="lg" isLoading={pending}>
        {!pending && <Send aria-hidden className="size-4" />}
        {pending ? 'Sending…' : 'Share my testimony'}
      </Button>
    </form>
  )
}
