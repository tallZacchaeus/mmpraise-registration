import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { OnboardingStepper } from '@/components/auth/onboarding-stepper'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { Alert, Card, CardBody } from '@/components/ui/primitives'
import { Separator } from '@/components/ui/separator'
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
      <CardBody className="space-y-8">
        {/* The stepper replaces the sentence "Step 1 of 2", which stated a
            position without showing where it led. */}
        <OnboardingStepper steps={STEPS} currentIndex={0} />

        <Separator />

        <div>
          <h1 className="text-3xl">Create your account</h1>
          <p className="mt-2 text-body">
            This takes about a minute. You will then complete your volunteer registration, and can
            save and return to it at any point.
          </p>
        </div>

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

const STEPS = [
  { id: 'account', label: 'Account', description: 'Name, email and password' },
  { id: 'registration', label: 'Registration', description: 'Department and availability' },
]
