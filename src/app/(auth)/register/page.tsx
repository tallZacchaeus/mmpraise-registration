import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { Alert, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { getSessionUser } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = {
  title: 'Create your volunteer account',
  description: 'Create an MMPraise volunteer account to begin your registration.',
}

export default async function RegisterPage() {
  const user = await getSessionUser()
  if (user) redirect('/apply')

  const settings = await getSettings()

  return (
    <Card>
      <CardHeader
        title="Create your account"
        description="Step 1 of 2 — set up your login, then complete your volunteer registration."
      />
      <CardBody>
        {!settings.registration_open ? (
          <Alert tone="warning" title="Registration is closed">
            {settings.registration_closed_message}
          </Alert>
        ) : (
          <SignUpForm />
        )}
      </CardBody>
    </Card>
  )
}
