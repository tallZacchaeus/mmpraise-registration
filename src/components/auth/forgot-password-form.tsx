'use client'

import { useState, useTransition } from 'react'
import { MailCheck } from 'lucide-react'
import { requestPasswordResetAction } from '@/app/(auth)/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Field, TextInput } from '@/components/ui/form'

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email })
      if (!result.ok) {
        setError(result.fieldErrors?.email ?? result.error)
        return
      }
      setSent(true)
    })
  }

  // The same confirmation is shown whether or not the address is registered —
  // the form must not reveal which addresses have accounts.
  if (sent) {
    return (
      <Alert tone="success" title="Check your email" icon={<MailCheck className="size-5" />}>
        If an account exists for <strong>{email}</strong>, we have sent a password reset link. It
        expires in 60 minutes. Remember to check your spam folder.
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="Email address" htmlFor="reset-email" required error={error ?? undefined}>
        <TextInput
          id="reset-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={Boolean(error)}
        />
      </Field>

      <Button type="submit" size="lg" isLoading={pending} className="w-full">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  )
}
