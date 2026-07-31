import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import type { LookupCategory } from '@/generated/prisma/enums'
import type { QuestionDef } from '@/lib/questions/engine'

/**
 * Reference-data reads.
 *
 * Wrapped in React's `cache` so a single render never queries the same list
 * twice. The HTTP routes that expose these lists set Cache-Control, so the
 * browser and any CDN in front of the app hold them too — the registration page
 * therefore does not download every country, region and parish on first paint.
 */

export const getCountries = cache(async () =>
  db.country.findMany({
    where: { isActive: true },
    select: { id: true, iso2: true, name: true, phoneCode: true, hasStates: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  }),
)

export const getStates = cache(async (countryId: string) =>
  db.state.findMany({
    where: { countryId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  }),
)

export const getChurchRegions = cache(async () =>
  db.churchRegion.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  }),
)

export const getChurchProvinces = cache(async (regionId: string) =>
  db.churchProvince.findMany({
    where: { regionId, isActive: true },
    select: { id: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  }),
)

export const getParishes = cache(async (provinceId: string, query?: string) =>
  db.parish.findMany({
    where: {
      provinceId,
      isActive: true,
      ...(query ? { name: { contains: query, mode: 'insensitive' as const } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 50,
  }),
)

export const getLookupOptions = cache(async (category: LookupCategory) =>
  db.lookupOption.findMany({
    where: { category, isActive: true },
    select: { value: true, label: true, requiresText: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  }),
)

export const getDepartments = cache(async () =>
  db.department.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true, description: true, capacity: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  }),
)

/** Departments with the number of non-draft applications, for capacity display. */
export const getDepartmentsWithLoad = cache(async () => {
  const [departments, counts] = await Promise.all([
    getDepartments(),
    db.volunteerApplication.groupBy({
      by: ['departmentId'],
      where: { status: { not: 'DRAFT' } },
      _count: { _all: true },
    }),
  ])

  const byId = new Map(counts.map((c) => [c.departmentId, c._count._all]))
  return departments.map((department) => ({
    ...department,
    applied: byId.get(department.id) ?? 0,
    isFull: department.capacity ? (byId.get(department.id) ?? 0) >= department.capacity : false,
  }))
})

/** Every active question for a department, shaped for the question engine. */
export const getDepartmentQuestions = cache(async (departmentId: string): Promise<QuestionDef[]> => {
  const questions = await db.departmentQuestion.findMany({
    where: { departmentId, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      options: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, value: true, label: true, requiresText: true },
      },
    },
  })

  return questions.map((q) => ({
    id: q.id,
    key: q.key,
    label: q.label,
    helpText: q.helpText,
    type: q.type,
    isRequired: q.isRequired,
    sortOrder: q.sortOrder,
    maxLength: q.maxLength,
    minValue: q.minValue,
    maxValue: q.maxValue,
    ratingMin: q.ratingMin,
    ratingMax: q.ratingMax,
    allowedMimeTypes: q.allowedMimeTypes,
    maxFileSizeKb: q.maxFileSizeKb,
    placeholder: q.placeholder,
    pattern: q.pattern,
    patternMessage: q.patternMessage,
    parentQuestionId: q.parentQuestionId,
    parentOptionValues: q.parentOptionValues,
    options: q.options,
  }))
})
