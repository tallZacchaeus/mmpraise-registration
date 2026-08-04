import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MigrationUploadForm } from '@/components/admin/migration/upload-form'
import { Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'

export const metadata: Metadata = { title: 'New import' }

export default async function NewMigrationBatchPage() {
  await requirePermission('migration:create')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/previous-participants"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-active underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to imports
        </Link>
        <h1 className="mt-2 text-3xl">Import previous participants</h1>
        <p className="mt-1 text-body">
          Step 1 of 3 — upload the file. You will map its columns next, then see exactly what would
          happen before anything is imported.
        </p>
      </div>

      <Card>
        <CardHeader title="The file" />
        <CardBody>
          <MigrationUploadForm />
        </CardBody>
      </Card>
    </div>
  )
}
