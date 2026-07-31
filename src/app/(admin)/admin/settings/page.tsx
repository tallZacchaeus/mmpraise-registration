import type { Metadata } from 'next'
import { SettingsForm } from '@/components/admin/settings-form'
import { Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Settings' }

export default async function AdminSettingsPage() {
  await requirePermission('settings:manage')
  const settings = await getSettings()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl">Settings</h1>
        <p className="mt-1 text-body">Control registration availability and event details.</p>
      </div>

      <Card>
        <CardHeader title="Registration" />
        <CardBody>
          <SettingsForm settings={settings} />
        </CardBody>
      </Card>
    </div>
  )
}
