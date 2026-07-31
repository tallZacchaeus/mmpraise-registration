import type { Metadata } from 'next'
import { ReferenceManager } from '@/components/admin/reference-manager'
import { Alert } from '@/components/ui/primitives'
import { requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Reference data' }

export default async function ReferencePage() {
  await requirePermission('reference:manage')

  const [regions, provinces, parishes] = await Promise.all([
    db.churchRegion.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, isActive: true } }),
    db.churchProvince.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, isActive: true, regionId: true },
    }),
    db.parish.findMany({
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, isActive: true, provinceId: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Reference data</h1>
        <p className="mt-1 text-body">
          Manage the RCCG region, province and parish lists used by the registration wizard.
        </p>
      </div>

      <Alert tone="warning" title="Replace the seeded structure">
        The regions and provinces shipped with this installation are a placeholder starting point. Replace
        them with the official RCCG structure before opening registration — no code change is needed.
      </Alert>

      <ReferenceManager
        regions={regions.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive }))}
        provinces={provinces.map((p) => ({ id: p.id, name: p.name, parentId: p.regionId, isActive: p.isActive }))}
        parishes={parishes.map((p) => ({ id: p.id, name: p.name, parentId: p.provinceId, isActive: p.isActive }))}
      />
    </div>
  )
}
