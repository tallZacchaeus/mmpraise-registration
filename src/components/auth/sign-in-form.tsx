'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { signInAction } from '@/app/(auth)/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Field, PasswordInput, TextInput } from '@/components/ui/form'

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await signInAction({ identifier, password, redirectTo })
      if (!result.ok) {
        setError(result.error)
        return
      }
      // Refresh so Server Components pick up the new session cookie.
      router.replace(result.data.redirectTo)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <Alert tone="danger" title="Could not sign you in">{error}</Alert>}

      <Field label="Email address or username" htmlFor="identifier" required>
        <TextInput
          id="identifier"
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          invalid={Boolean(error)}
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          invalid={Boolean(error)}
        />
      </Field>

      <div className="flex items-center justify-between gap-4">
        <Link href="/forgot-password" className="text-sm text-primary underline underline-offset-4 hover:text-primary-hover">
          Forgot your password?
        </Link>
      </div>

      <Button type="submit" size="lg" isLoading={pending} className="w-full">
        {!pending && <LogIn aria-hidden className="size-4" />}
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-center text-sm text-muted">
        New volunteer?{' '}
        <Link href="/register" className="font-semibold text-primary underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  )
}
