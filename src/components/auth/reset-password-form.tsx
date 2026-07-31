'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resetPasswordAction } from '@/app/(auth)/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Field, PasswordInput } from '@/components/ui/form'
import { resetPasswordSchema } from '@/lib/validation/auth'
import type { FieldErrors } from '@/lib/actions/result'

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.')
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }

    setErrors({})
    startTransition(async () => {
      const result = await resetPasswordAction({ token, password, confirmPassword })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setFormError(result.fieldErrors ? null : result.error)
        return
      }
      router.replace('/login?reset=1')
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="danger" title="Could not reset your password">{formError}</Alert>}

      <Field label="New password" htmlFor="new-password" required error={errors.password}>
        <PasswordInput
          id="new-password"
          required
          showMeter
          value={password}
          onChange={setPassword}
          invalid={Boolean(errors.password)}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirm-new-password" required error={errors.confirmPassword}>
        <PasswordInput
          id="confirm-new-password"
          required
          value={confirmPassword}
          onChange={setConfirmPassword}
          invalid={Boolean(errors.confirmPassword)}
        />
      </Field>

      <Alert tone="info">
        For your security, changing your password signs you out of every device.
      </Alert>

      <Button type="submit" size="lg" isLoading={pending} className="w-full">
        {pending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  )
}
