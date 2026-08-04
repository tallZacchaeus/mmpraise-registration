'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Loader2, Lock, Mail, ShieldCheck, X } from 'lucide-react'
import { checkUsernameAction, signUpAction } from '@/app/(auth)/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Checkbox, ErrorSummary, Field, PasswordInput, TextInput } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { useReveal } from '@/lib/motion'
import { signUpSchema } from '@/lib/validation/auth'
import { suggestUsername } from '@/lib/validation/common'
import { cn } from '@/lib/utils'
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

type UsernameState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken'; suggestions: string[] }

export function SignUpForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [usernameEdited, setUsernameEdited] = useState(false)
  /** The last verdict received, tagged with the username it was for. */
  const [usernameCheck, setUsernameCheck] = useState<{
    username: string
    available: boolean
    suggestions: string[]
  } | null>(null)

  // Sections rise in sequence on first paint. Nothing is hidden until GSAP has
  // confirmed it will run, so the form is usable before and without hydration.
  const formRef = useReveal<HTMLFormElement>({ stagger: 0.06, y: 14, selector: '[data-field]' })

  /**
   * The username is derived from the applicant's name until they edit it.
   * Deriving during render rather than syncing through an effect keeps one
   * source of truth and avoids a cascading re-render on every keystroke.
   */
  const username = useMemo(() => {
    if (usernameEdited) return values.username
    if (!values.firstName || !values.lastName) return ''
    return suggestUsername(values.firstName, values.lastName)
  }, [usernameEdited, values.username, values.firstName, values.lastName])

  /** Live availability, debounced. Only fires once typing settles. */
  useEffect(() => {
    if (username.length < 3) return

    const timer = setTimeout(async () => {
      const result = await checkUsernameAction(username)
      if (!result.ok) return
      setUsernameCheck({
        username,
        available: result.data.available,
        suggestions: result.data.suggestions,
      })
    }, 450)

    return () => clearTimeout(timer)
  }, [username])

  /**
   * Derived, not stored.
   *
   * Because the verdict carries the username it was for, a slow earlier
   * response can never be shown against a newer value — it simply does not
   * match, and the field reads as still checking. That removes the request-id
   * bookkeeping a stored state would need, and it satisfies the compiler rule
   * against setting state from an effect body.
   */
  const usernameState = useMemo<UsernameState>(() => {
    if (username.length < 3) return { status: 'idle' }
    if (!usernameCheck || usernameCheck.username !== username) return { status: 'checking' }
    return usernameCheck.available
      ? { status: 'available' }
      : { status: 'taken', suggestions: usernameCheck.suggestions }
  }, [username, usernameCheck])

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

  const confirmMatches =
    values.confirmPassword.length > 0 && values.confirmPassword === values.password

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-8">
      <div data-field>
        <ErrorSummary id="signup-errors" errors={summary} />
        {formError && (
          <Alert tone="danger" title="Could not create your account">
            {formError}
          </Alert>
        )}
      </div>

      {/* ------------------------------------------------ Personal details */}
      <FormSection
        title="Your name"
        description="How you will appear to the department that reviews your application."
      >
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
      </FormSection>

      <Separator />

      {/* -------------------------------------------------- Account details */}
      <FormSection
        title="Account details"
        description="How you sign in, and where we send everything about your application."
      >
        <div className="space-y-5">
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
              invalid={Boolean(errors.username) || usernameState.status === 'taken'}
              aria-describedby={errors.username ? 'signup-username-error' : 'signup-username-help'}
            />
            <UsernameStatus
              state={usernameState}
              onPick={(suggestion) => {
                setUsernameEdited(true)
                set('username', suggestion)
              }}
            />
          </Field>
        </div>
      </FormSection>

      <Separator />

      {/* --------------------------------------------------------- Security */}
      <FormSection
        title="Security"
        description="Choose something you have not used elsewhere, or let us generate one."
      >
        <div className="space-y-5">
          <Field label="Password" htmlFor="signup-password" required error={errors.password}>
            <PasswordInput
              id="signup-password"
              required
              showMeter
              showGenerate
              value={values.password}
              onChange={(v) => set('password', v)}
              invalid={Boolean(errors.password)}
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="signup-confirmPassword"
            required
            error={errors.confirmPassword}
          >
            <PasswordInput
              id="signup-confirmPassword"
              required
              value={values.confirmPassword}
              onChange={(v) => set('confirmPassword', v)}
              invalid={Boolean(errors.confirmPassword)}
            />
            {/* Confirmed as you type, rather than only on submit. */}
            {values.confirmPassword.length > 0 && (
              <p
                className={cn(
                  'mt-2 flex items-center gap-1.5 text-xs font-medium',
                  confirmMatches ? 'text-success' : 'text-muted',
                )}
                aria-live="polite"
              >
                {confirmMatches ? (
                  <Check aria-hidden className="size-4 shrink-0" />
                ) : (
                  <X aria-hidden className="size-4 shrink-0" />
                )}
                {confirmMatches ? 'Both passwords match.' : 'Both passwords must match.'}
              </p>
            )}
          </Field>
        </div>
      </FormSection>

      <Separator />

      {/* ----------------------------------------------------------- Terms */}
      <div data-field>
        <Field
          label=""
          htmlFor="signup-acceptTerms"
          error={errors.acceptTerms}
          className="[&>label]:sr-only"
        >
          <div
            className={cn(
              'rounded-card border p-4 transition-colors duration-200 motion-reduce:transition-none',
              errors.acceptTerms
                ? 'border-danger bg-danger-subtle'
                : values.acceptTerms
                  ? 'border-primary-border bg-primary-subtle'
                  : 'border-line bg-surface-sunken',
            )}
          >
            <Checkbox
              checked={values.acceptTerms}
              onChange={(checked) => set('acceptTerms', checked)}
              invalid={Boolean(errors.acceptTerms)}
              label={
                <>
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary-active underline underline-offset-2"
                  >
                    volunteer terms and code of conduct
                  </Link>{' '}
                  and the{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary-active underline underline-offset-2"
                  >
                    privacy notice
                  </Link>
                  .
                </>
              }
              description="Both open in a new tab, so you keep everything you have typed."
            />
          </div>
        </Field>
      </div>

      <div data-field className="space-y-5">
        <Button type="submit" size="lg" isLoading={pending} className="w-full">
          {pending ? 'Creating your account…' : 'Continue to volunteer registration'}
          {!pending && <ArrowRight aria-hidden className="size-4" />}
        </Button>

        {/* ------------------------------------------------------- Assurance */}
        <ul className="space-y-2 text-xs text-muted">
          <TrustPoint icon={Lock}>
            Your password is hashed before it is stored. Nobody at MMPraise can read it.
          </TrustPoint>
          <TrustPoint icon={ShieldCheck}>
            Your details are used to coordinate volunteers, and for nothing else.
          </TrustPoint>
          <TrustPoint icon={Mail}>
            We email you about your application — never marketing you did not ask for.
          </TrustPoint>
        </ul>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs uppercase tracking-wide text-muted">or</span>
          <Separator className="flex-1" />
        </div>

        <p className="text-center text-sm text-body">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  )
}

/** A titled group of fields, so the form scans as three short tasks. */
function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section data-field>
      <h2 className="text-base">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function TrustPoint({ icon: Icon, children }: { icon: typeof Lock; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
      <span>{children}</span>
    </li>
  )
}

/**
 * Live verdict on the chosen username.
 *
 * `aria-live="polite"` so the outcome is announced without stealing focus while
 * the applicant is still typing. A rejection always comes with alternatives —
 * "taken" on its own is a dead end.
 */
function UsernameStatus({
  state,
  onPick,
}: {
  state: UsernameState
  onPick: (suggestion: string) => void
}) {
  if (state.status === 'idle') return null

  return (
    <div className="mt-2 text-xs" aria-live="polite">
      {state.status === 'checking' && (
        <p className="flex items-center gap-1.5 text-muted">
          <Loader2
            aria-hidden
            className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
          />
          Checking availability…
        </p>
      )}

      {state.status === 'available' && (
        <p className="flex items-center gap-1.5 font-medium text-success">
          <Check aria-hidden className="size-4 shrink-0" />
          That username is available.
        </p>
      )}

      {state.status === 'taken' && (
        <div>
          <p className="flex items-center gap-1.5 font-medium text-danger">
            <X aria-hidden className="size-4 shrink-0" />
            That username is already taken.
          </p>
          {state.suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-muted">Try:</span>
              {state.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onPick(suggestion)}
                  className="rounded-pill border border-line-strong px-2.5 py-1 font-medium text-ink transition-colors hover:border-primary hover:bg-primary-subtle motion-reduce:transition-none"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
