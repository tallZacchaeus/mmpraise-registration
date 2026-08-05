import type { Metadata } from 'next'
import { AnnouncementEditor } from '@/components/admin/announcements/announcement-editor'
import { Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { can, departmentScope, requirePermission } from '@/lib/auth/rbac'
import { getDepartments } from '@/lib/reference'

export const metadata: Metadata = { title: 'New announcement' }

/** A fresh draft. Publishing happens on the announcement's own page. */
export default async function NewAnnouncementPage() {
  const user = await requirePermission('announcement:manage')
  const scope = departmentScope(user)
  const allDepartments = await getDepartments()
  const departments =
    scope === null ? allDepartments : allDepartments.filter((d) => scope.includes(d.id))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl">New announcement</h1>
        <p className="mt-1 text-body">
          Saved as a draft first — nothing is visible to volunteers until you publish it.
        </p>
      </div>
      <Card>
        <CardHeader title="Content and audience" />
        <CardBody>
          <AnnouncementEditor
            announcement={null}
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
            canEmail={can(user, 'volunteer:message')}
            restrictedToDepartments={scope !== null}
          />
        </CardBody>
      </Card>
    </div>
  )
}
