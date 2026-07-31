import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  ChangePasswordForm,
  DeletionRequestForm,
  ProfilePhotoForm,
} from '@/components/dashboard/account-forms'
import { Alert, Badge, buttonClass, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { requireUser } from '@/lib/auth/rbac'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Account settings' }

export default async function AccountPage() {
  const user = await requireUser()

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      username: true,
      phone: true,
      emailVerifiedAt: true,
      createdAt: true,
      deletionRequestedAt: true,
      profile: { select: { photoDocumentId: true } },
    },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to dashboard
        </Link>
        <h1 className="mt-4 text-3xl">Account settings</h1>
      </div>

      <Card>
        <CardHeader title="Your account" />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Email address</dt>
              <dd className="flex flex-wrap items-center gap-2 font-medium text-ink">
                {record?.email}
                {record?.emailVerifiedAt ? (
                  <Badge tone="success">Confirmed</Badge>
                ) : (
                  <Badge tone="warning">Not confirmed</Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Username</dt>
              <dd className="font-medium text-ink">{record?.username}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Phone number</dt>
              <dd className="font-medium text-ink">{record?.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Member since</dt>
              <dd className="font-medium text-ink">{formatDate(record?.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">Roles</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <Badge key={role} tone={role === 'VOLUNTEER' ? 'neutral' : 'brand'}>
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>

          {!record?.emailVerifiedAt && (
            <Alert tone="warning" className="mt-5">
              <Link href="/verify-email" className="font-semibold underline underline-offset-4">
                Resend the confirmation email
              </Link>{' '}
              to confirm your address.
            </Alert>
          )}

          <p className="mt-5 text-sm text-muted">
            To change your name, email address or phone number, edit them in{' '}
            <Link href="/apply/personal" className="text-primary underline underline-offset-4">
              your registration details
            </Link>
            .
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Profile photograph" description="Used on your volunteer pass." />
        <CardBody>
          <ProfilePhotoForm documentId={record?.profile?.photoDocumentId ?? null} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Change password" description="Choose something you have not used here before." />
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Delete your data" />
        <CardBody>
          <DeletionRequestForm
            requestedAt={record?.deletionRequestedAt ? formatDate(record.deletionRequestedAt) : null}
          />
        </CardBody>
      </Card>
    </div>
  )
}
