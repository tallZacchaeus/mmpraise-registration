'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Send } from 'lucide-react'
import { submitContactAction } from '@/app/(site)/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { ErrorSummary, Field, SelectInput, TextArea, TextInput } from '@/components/ui/form'
import { contactCategories, type ContactCategoryValue } from '@/content/contact'
import type { FieldErrors } from '@/lib/actions/result'

/**
 * Contact form.
 *
 * The form it replaces has four unlabelled fields, none of them required, and a
 * textarea named `prayer-request` — so a general enquiry and a prayer request
 * were the same submission. This one labels every field, marks what is
 * required, asks what the message is about, and reports errors in a summary
 * that moves focus so a screen-reader user is told what went wrong.
 *
 * Nothing sent here is ever published: messages go to the admin inbox only.
 */
export function ContactForm() {
  const [category, setCategory] = useState<ContactCategoryValue>('GENERAL')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  /**
   * The summary links to each field by element id, so the keys are prefixed to
   * match the ids rendered below rather than the schema's field names.
   */
  const errorList = Object.entries(errors).map(([field, message]) => ({
    field: `contact-${field}`,
    message,
  }))

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    startTransition(async () => {
      try {
        const result = await submitContactAction({
          category,
          name,
          email,
          phone,
          subject,
          message,
          website,
        })

        if (!result.ok) {
          setErrors(result.fieldErrors ?? {})
          setFormError(result.fieldErrors ? null : result.error)
          // Move focus to the summary so the failure is announced rather than
          // left for the user to find by scrolling.
          requestAnimationFrame(() => document.getElementById('contact-errors')?.focus())
          return
        }

        setErrors({})
        setSent(true)
      } catch {
        setFormError('We could not send your message. Please check your connection and try again.')
      }
    })
  }

  if (sent) {
    return (
      <Alert
        tone="success"
        title="Thank you for reaching out"
        icon={<CheckCircle2 className="size-5" />}
      >
        Our team will review your message and respond as soon as possible. Your message is not
        published anywhere — only the MMPraise team can read it.
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ErrorSummary id="contact-errors" errors={errorList} />

      {formError && <Alert tone="danger">{formError}</Alert>}

      {/* Bots fill every field they find; humans never see this one. */}
      <div aria-hidden className="hidden">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <Field
        label="What is your message about?"
        htmlFor="contact-category"
        required
        error={errors.category}
        help="This sends your message to the right team."
      >
        <SelectInput
          id="contact-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as ContactCategoryValue)}
          invalid={Boolean(errors.category)}
        >
          {contactCategories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="contact-name" required error={errors.name}>
          <TextInput
            id="contact-name"
            autoComplete="name"
            placeholder="Adaeze Okonkwo"
            value={name}
            onChange={(event) => setName(event.target.value)}
            invalid={Boolean(errors.name)}
          />
        </Field>

        <Field label="Email address" htmlFor="contact-email" required error={errors.email}>
          <TextInput
            id="contact-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(errors.email)}
          />
        </Field>
      </div>

      <Field
        label="Phone number"
        htmlFor="contact-phone"
        error={errors.phone}
        help="Optional. Include the country code if you are outside Nigeria."
      >
        <TextInput
          id="contact-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+234 703 385 3817"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          invalid={Boolean(errors.phone)}
        />
      </Field>

      <Field label="Subject" htmlFor="contact-subject" required error={errors.subject}>
        <TextInput
          id="contact-subject"
          placeholder="Question about volunteering for the media team"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          invalid={Boolean(errors.subject)}
        />
      </Field>

      <Field
        label="Message"
        htmlFor="contact-message"
        required
        error={errors.message}
        help="Tell us what you need. The more context you give, the better we can help."
      >
        <TextArea
          id="contact-message"
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          invalid={Boolean(errors.message)}
        />
      </Field>

      <Button type="submit" size="lg" isLoading={pending}>
        {!pending && <Send aria-hidden className="size-4" />}
        {pending ? 'Sending your message…' : 'Send message'}
      </Button>

      <p className="text-xs text-muted">
        We store your message securely so the team has a record of it, and we use your details only
        to reply. Read our{' '}
        <Link href="/privacy" className="underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
    </form>
  )
}
