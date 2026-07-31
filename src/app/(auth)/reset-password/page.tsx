import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { Alert, Card, CardBody, CardHeader } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Choose a new password' }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <Card>
      <CardHeader title="Choose a new password" description="Pick something you have not used on this account before." />
      <CardBody>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <Alert tone="danger" title="This link is not valid">
              The reset link is missing its token. Request a new link and try again.
            </Alert>
            <Link href="/forgot-password" className="font-semibold text-primary underline underline-offset-4">
              Request a new reset link
            </Link>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
