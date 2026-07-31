'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { signUpAction } from '@/app/(auth)/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Checkbox, ErrorSummary, Field, PasswordInput, TextInput } from '@/components/ui/form'
import { signUpSchema } from '@/lib/validation/auth'
import { suggestUsername } from '@/lib/validation/common'
import type { FieldErrors } from '@/lib/actions/result'

type Values = {
  firstName: string
  lastName: string
  email: string
  username: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
}

const EMPTY: Values = {
  firstName: '',
  lastName: '',
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
}

const LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email address',
  username: 'Username',
  password: 'Password',
  confirmPassword: 'Confirm password',
  acceptTerms: 'Volunteer terms',
}

export function SignUpForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [usernameEdited, setUsernameEdited] = useState(false)

  /**
   * The username is derived from the applicant's name until they edit it.
   * Deriving during render rather than syncing through an effect keeps a single
   * source of truth and avoids a cascading re-render on every keystroke.
   */
  const username = useMemo(() => {
    if (usernameEdited) return values.username
    if (!values.firstName || !values.lastName) return ''
    return suggestUsername(values.firstName, values.lastName)
  }, [usernameEdited, values.username, values.firstName, values.lastName])

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    const parsed = signUpSchema.safeParse({ ...values, username })
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_form'
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      document.getElementById('signup-errors')?.focus()
      return
    }

    startTransition(async () => {
      const result = await signUpAction({ ...values, username })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setFormError(result.fieldErrors ? null : result.error)
        document.getElementById('signup-errors')?.focus()
        return
      }
      router.replace(result.data.redirectTo)
      router.refresh()
    })
  }

  const summary = Object.entries(errors).map(([field, message]) => ({
    field: `signup-${field}`,
    message: `${LABELS[field] ?? field}: ${message}`,
  }))

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <ErrorSummary id="signup-errors" errors={summary} />
      {formError && <Alert tone="danger" title="Could not create your account">{formError}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="signup-firstName" required error={errors.firstName}>
          <TextInput
            id="signup-firstName"
            autoComplete="given-name"
            required
            value={values.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            invalid={Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? 'signup-firstName-error' : undefined}
          />
        </Field>

        <Field label="Last name" htmlFor="signup-lastName" required error={errors.lastName}>
          <TextInput
            id="signup-lastName"
            autoComplete="family-name"
            required
            value={values.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? 'signup-lastName-error' : undefined}
          />
        </Field>
      </div>

      <Field
        label="Email address"
        htmlFor="signup-email"
        required
        error={errors.email}
        help="We send your registration confirmation and status updates here."
      >
        <TextInput
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'signup-email-error' : 'signup-email-help'}
        />
      </Field>

      <Field
        label="Username"
        htmlFor="signup-username"
        required
        error={errors.username}
        help="Suggested from your name — change it if you prefer something else."
      >
        <TextInput
          id="signup-username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => {
            setUsernameEdited(true)
            set('username', e.target.value)
          }}
          invalid={Boolean(errors.username)}
          aria-describedby={errors.username ? 'signup-username-error' : 'signup-username-help'}
        />
      </Field>

      <Field label="Password" htmlFor="signup-password" required error={errors.password}>
        <PasswordInput
          id="signup-password"
          required
          showMeter
          value={values.password}
          onChange={(v) => set('password', v)}
          invalid={Boolean(errors.password)}
        />
      </Field>

      <Field label="Confirm password" htmlFor="signup-confirmPassword" required error={errors.confirmPassword}>
        <PasswordInput
          id="signup-confirmPassword"
          required
          value={values.confirmPassword}
          onChange={(v) => set('confirmPassword', v)}
          invalid={Boolean(errors.confirmPassword)}
        />
      </Field>

      <Field label="" htmlFor="signup-acceptTerms" error={errors.acceptTerms} className="[&>label]:sr-only">
        <Checkbox
          checked={values.acceptTerms}
          onChange={(checked) => set('acceptTerms', checked)}
          invalid={Boolean(errors.acceptTerms)}
          label={
            <>
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="font-semibold text-primary underline underline-offset-2">
                volunteer terms and code of conduct
              </Link>{' '}
              and the{' '}
              <Link href="/privacy" target="_blank" className="font-semibold text-primary underline underline-offset-2">
                privacy notice
              </Link>
              .
            </>
          }
          description="Opens in a new tab so you keep everything you have typed."
        />
      </Field>

      <Button type="submit" size="lg" isLoading={pending} className="w-full">
        {!pending && <UserPlus aria-hidden className="size-4" />}
        {pending ? 'Creating your account…' : 'Create account and continue'}
      </Button>

      <p className="text-center text-sm text-muted">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  )
}
