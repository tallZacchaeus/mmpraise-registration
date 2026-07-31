import type { Metadata } from 'next'
import { AnnouncementForm, TogglePublish } from '@/components/admin/announcement-form'
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui/primitives'
import { can, departmentScope, requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { getDepartments } from '@/lib/reference'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Announcements' }

export default async function AnnouncementsPage() {
  const user = await requirePermission('announcement:manage')
  const scope = departmentScope(user)
  const allDepartments = await getDepartments()

  const departments = scope === null ? allDepartments : allDepartments.filter((d) => scope.includes(d.id))

  const announcements = await db.announcement.findMany({
    where: scope === null ? {} : { departmentId: { in: scope.length ? scope : ['__none__'] } },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { department: { select: { name: true } }, createdBy: { select: { username: true } } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Announcements</h1>
        <p className="mt-1 text-body">Publish updates to volunteer dashboards, and optionally email them.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="New announcement" />
          <CardBody>
            <AnnouncementForm
              departments={departments.map((d) => ({ id: d.id, name: d.name }))}
              canEmail={can(user, 'volunteer:message')}
              restrictedToDepartments={scope !== null}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent announcements" />
          <CardBody>
            {announcements.length === 0 ? (
              <EmptyState title="Nothing published yet" description="Announcements you create will be listed here." />
            ) : (
              <ul className="space-y-4">
                {announcements.map((announcement) => (
                  <li key={announcement.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display font-bold uppercase text-ink">{announcement.title}</p>
                        <p className="text-xs text-muted">
                          {announcement.publishedAt ? formatDate(announcement.publishedAt, true) : 'Draft'}
                          {announcement.createdBy ? ` · ${announcement.createdBy.username}` : ''}
                          {announcement.department ? ` · ${announcement.department.name}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={announcement.publishedAt ? 'success' : 'neutral'}>
                          {announcement.publishedAt ? 'Published' : 'Draft'}
                        </Badge>
                        <TogglePublish id={announcement.id} published={Boolean(announcement.publishedAt)} />
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-body">{announcement.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
