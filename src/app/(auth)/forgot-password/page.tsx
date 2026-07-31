import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { Card, CardBody, CardHeader } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Reset your password' }

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader
        title="Reset your password"
        description="Enter the email address you registered with and we will send you a reset link."
      />
      <CardBody>
        <ForgotPasswordForm />
        <p className="mt-6 text-center text-sm text-muted">
          Remembered it?{' '}
          <Link href="/login" className="font-semibold text-primary underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  )
}
