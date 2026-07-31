'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Mail } from 'lucide-react'
import { subscribeAction } from '@/app/(site)/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Checkbox, Field, TextInput } from '@/components/ui/form'
import type { FieldErrors } from '@/lib/actions/result'

/**
 * Update subscription.
 *
 * The current site has a bare, unlabelled email box with no explanation of what
 * subscribing does. This version states the purpose, labels the field, asks for
 * explicit consent and links the privacy notice.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    startTransition(async () => {
      try {
        const result = await subscribeAction({ email, consentGiven, website })
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {})
          setFormError(result.fieldErrors ? null : result.error)
          return
        }
        setEmail('')
        setConsentGiven(false)
        setErrors({})
        setSubscribed(true)
      } catch {
        setFormError('We could not sign you up. Please check your connection and try again.')
      }
    })
  }

  if (subscribed) {
    return (
      <Alert tone="success" title="You are on the list" icon={<CheckCircle2 className="size-5" />}>
        We will email you when registration opens, when the schedule is published, and when the marathon
        goes live. You can unsubscribe from any message.
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="danger">{formError}</Alert>}

      <div aria-hidden className="hidden">
        <label htmlFor="newsletter-website">Leave this field empty</label>
        <input
          id="newsletter-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <Field label="Email address" htmlFor="newsletter-email" required error={errors.email}>
        <TextInput
          id="newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          invalid={Boolean(errors.email)}
        />
      </Field>

      <div>
        <Checkbox
          checked={consentGiven}
          onChange={setConsentGiven}
          invalid={Boolean(errors.consentGiven)}
          label="Yes, send me MMPraise event announcements."
          description="Event dates, registration openings and livestream reminders. No more than a few emails a year."
        />
        {errors.consentGiven && <p className="mt-1 text-sm font-medium text-danger">{errors.consentGiven}</p>}
      </div>

      <Button type="submit" isLoading={pending}>
        {!pending && <Mail aria-hidden className="size-4" />}
        {pending ? 'Signing you up…' : 'Keep me updated'}
      </Button>

      <p className="text-xs text-muted">
        We store your address securely and never sell it. Read our{' '}
        <Link href="/privacy" className="underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
    </form>
  )
}
