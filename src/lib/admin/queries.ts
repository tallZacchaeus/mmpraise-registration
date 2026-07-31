import 'server-only'
import { db } from '@/lib/db'
import type { ApplicationStatus, Prisma } from '@/generated/prisma/client'
import { departmentScope } from '@/lib/auth/rbac'
import type { SessionUser } from '@/lib/auth/session'

/**
 * Administrative queries over volunteer applications.
 *
 * Every list is built through `buildWhere`, which folds the caller's department
 * scope into the filter. A department head therefore cannot see another team's
 * applications even by crafting query parameters — the restriction is applied
 * server-side to the SQL, not to the rendered output.
 *
 * Health information is never selected here; it has its own gated accessor.
 */
export type ApplicationFilters = {
  q?: string
  status?: string
  departmentId?: string
  countryId?: string
  stateId?: string
  churchRegionId?: string
  churchProvinceId?: string
  ageRange?: string
  page?: number
  perPage?: number
  sort?: 'newest' | 'oldest' | 'name'
}

export const PER_PAGE_DEFAULT = 25

export function buildWhere(user: SessionUser, filters: ApplicationFilters): Prisma.VolunteerApplicationWhereInput {
  const scope = departmentScope(user)

  const where: Prisma.VolunteerApplicationWhereInput = {
    // Drafts are the volunteer's private workspace and never appear in review lists.
    status: { not: 'DRAFT' },
  }

  if (scope !== null) {
    // An empty scope must match nothing, not everything.
    where.departmentId = scope.length > 0 ? { in: scope } : '__none__'
  }

  if (filters.status && filters.status !== 'all') {
    where.status = filters.status as ApplicationStatus
  }

  if (filters.departmentId && filters.departmentId !== 'all') {
    // Intersect with the scope rather than replacing it.
    if (scope === null || scope.includes(filters.departmentId)) {
      where.departmentId = filters.departmentId
    } else {
      where.departmentId = '__none__'
    }
  }

  const profileFilter: Prisma.VolunteerProfileWhereInput = {}
  if (filters.countryId && filters.countryId !== 'all') profileFilter.countryId = filters.countryId
  if (filters.stateId && filters.stateId !== 'all') profileFilter.stateId = filters.stateId
  if (filters.churchRegionId && filters.churchRegionId !== 'all') profileFilter.churchRegionId = filters.churchRegionId
  if (filters.churchProvinceId && filters.churchProvinceId !== 'all') {
    profileFilter.churchProvinceId = filters.churchProvinceId
  }
  if (filters.ageRange && filters.ageRange !== 'all') {
    profileFilter.ageRange = filters.ageRange as Prisma.VolunteerProfileWhereInput['ageRange']
  }

  if (Object.keys(profileFilter).length > 0) {
    where.user = { profile: profileFilter }
  }

  const q = filters.q?.trim()
  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const }
    where.OR = [
      { registrationId: contains },
      { user: { email: contains } },
      { user: { phone: contains } },
      { user: { username: contains } },
      { user: { profile: { firstName: contains } } },
      { user: { profile: { lastName: contains } } },
    ]
  }

  return where
}

export async function listApplications(user: SessionUser, filters: ApplicationFilters) {
  const page = Math.max(1, filters.page ?? 1)
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? PER_PAGE_DEFAULT))
  const where = buildWhere(user, filters)

  const orderBy: Prisma.VolunteerApplicationOrderByWithRelationInput =
    filters.sort === 'oldest'
      ? { submittedAt: 'asc' }
      : filters.sort === 'name'
        ? { user: { profile: { lastName: 'asc' } } }
        : { submittedAt: 'desc' }

  const [total, items] = await Promise.all([
    db.volunteerApplication.count({ where }),
    db.volunteerApplication.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        registrationId: true,
        status: true,
        submittedAt: true,
        department: { select: { id: true, name: true } },
        user: {
          select: {
            email: true,
            phone: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                ageRange: true,
                gender: true,
                city: true,
                photoDocumentId: true,
                country: { select: { name: true } },
                state: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ])

  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) }
}

/** Full application for the review screen. Excludes health information. */
export async function getApplicationForReview(user: SessionUser, id: string) {
  const scope = departmentScope(user)

  const application = await db.volunteerApplication.findUnique({
    where: { id },
    include: {
      department: true,
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          username: true,
          emailVerifiedAt: true,
          profile: {
            include: {
              country: { select: { name: true } },
              state: { select: { name: true } },
              region: { select: { name: true } },
              province: { select: { name: true } },
              parish: { select: { name: true } },
            },
          },
        },
      },
      answers: {
        include: {
          question: { select: { id: true, key: true, label: true, type: true, sortOrder: true } },
          options: { include: { option: { select: { value: true, label: true } } } },
          document: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
        },
      },
      availability: { orderBy: { date: 'asc' } },
      emergency: true,
      documents: { select: { id: true, kind: true, originalName: true, mimeType: true, sizeBytes: true } },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
        include: { changedBy: { select: { username: true } } },
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { username: true } } },
      },
      assignments: { include: { shift: true } },
    },
  })

  if (!application) return null
  if (application.status === 'DRAFT') return null
  if (scope !== null && (!application.departmentId || !scope.includes(application.departmentId))) return null

  return application
}

/** Aggregate counts for the admin overview. */
export async function getAnalytics(user: SessionUser) {
  const where = buildWhere(user, {})

  const [byStatus, byDepartment, byCountry, byAgeRange, total, recent] = await Promise.all([
    db.volunteerApplication.groupBy({ by: ['status'], where, _count: { _all: true } }),
    db.volunteerApplication.groupBy({ by: ['departmentId'], where, _count: { _all: true } }),
    db.volunteerProfile.groupBy({
      by: ['countryId'],
      where: { user: { applications: { some: where } } },
      _count: { _all: true },
      orderBy: { _count: { countryId: 'desc' } },
      take: 8,
    }),
    db.volunteerProfile.groupBy({
      by: ['ageRange'],
      where: { user: { applications: { some: where } } },
      _count: { _all: true },
    }),
    db.volunteerApplication.count({ where }),
    db.volunteerApplication.count({
      where: { ...where, submittedAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } },
    }),
  ])

  const departments = await db.department.findMany({ select: { id: true, name: true, capacity: true } })
  const countries = await db.country.findMany({
    where: { id: { in: byCountry.map((c) => c.countryId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, name: true },
  })

  return {
    total,
    recent,
    byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    byDepartment: byDepartment.map((row) => ({
      department: departments.find((d) => d.id === row.departmentId) ?? null,
      count: row._count._all,
    })),
    byCountry: byCountry.map((row) => ({
      country: countries.find((c) => c.id === row.countryId)?.name ?? 'Unknown',
      count: row._count._all,
    })),
    byAgeRange: byAgeRange.map((row) => ({ ageRange: row.ageRange, count: row._count._all })),
  }
}
