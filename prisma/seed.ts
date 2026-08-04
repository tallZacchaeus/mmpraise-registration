/**
 * Idempotent database seed.
 *
 * Safe to run repeatedly: every write is an upsert keyed on a natural unique
 * column, so re-running never duplicates reference data and never overwrites
 * records an administrator has edited beyond the seeded fields.
 *
 *   npm run db:seed
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import type { LookupCategory, QuestionType } from '../src/generated/prisma/enums'
import { hashPassword } from '../src/lib/auth/password'
import { COUNTRIES, PRIORITY_COUNTRIES, STATES } from './seed-data/geography'
import { CONTINENTS, REGIONS } from './seed-data/church'
import { churchDirectory } from './seed-data/church-directory'
import { DEPARTMENTS } from './seed-data/departments'
import { DISCOVERY_SOURCES, EDUCATION_LEVELS, OCCUPATIONS } from './seed-data/lookups'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

async function seedCountries() {
  let created = 0
  for (const [iso2, iso3, phoneCode] of COUNTRIES) {
    const name = regionNames.of(iso2) ?? iso2
    const priorityIndex = PRIORITY_COUNTRIES.indexOf(iso2)
    await db.country.upsert({
      where: { iso2 },
      update: { name, phoneCode, hasStates: Boolean(STATES[iso2]), sortOrder: priorityIndex >= 0 ? priorityIndex - 100 : 0 },
      create: {
        iso2,
        iso3,
        name,
        phoneCode,
        hasStates: Boolean(STATES[iso2]),
        sortOrder: priorityIndex >= 0 ? priorityIndex - 100 : 0,
      },
    })
    created++
  }

  let stateCount = 0
  for (const [iso2, names] of Object.entries(STATES)) {
    const country = await db.country.findUnique({ where: { iso2 } })
    if (!country) continue
    for (const name of names) {
      await db.state.upsert({
        where: { countryId_name: { countryId: country.id, name } },
        update: {},
        create: { countryId: country.id, name },
      })
      stateCount++
    }
  }
  console.log(`  countries: ${created}, states/provinces: ${stateCount}`)
}

async function seedChurchHierarchy() {
  for (const [index, name] of CONTINENTS.entries()) {
    await db.churchContinent.upsert({
      where: { name },
      update: { sortOrder: index },
      create: { name, sortOrder: index },
    })
  }

  const africa = await db.churchContinent.findUnique({ where: { name: 'Africa' } })

  /*
   * The Nigerian hierarchy comes from the organisation's own directory
   * (DIRECTORIES.xlsx → seed-data/church-directory.ts): 66 regions, 469
   * provinces. Everything is upserted by name rather than recreated, because
   * volunteer profiles hold foreign keys to these rows and deleting one would
   * orphan somebody's application.
   */
  const seenRegionIds = new Set<string>()
  const seenProvinceIds = new Set<string>()
  let provinceCount = 0

  for (const [index, region] of churchDirectory.entries()) {
    const saved = await db.churchRegion.upsert({
      where: { name: region.name },
      update: { continentId: africa?.id, sortOrder: index, isActive: true },
      create: { name: region.name, continentId: africa?.id, sortOrder: index },
    })
    seenRegionIds.add(saved.id)

    for (const [pIndex, provinceName] of region.provinces.entries()) {
      const province = await db.churchProvince.upsert({
        where: { regionId_name: { regionId: saved.id, name: provinceName } },
        update: { sortOrder: pIndex, isActive: true },
        create: { regionId: saved.id, name: provinceName, sortOrder: pIndex },
      })
      seenProvinceIds.add(province.id)
      provinceCount++
    }
  }

  /*
   * Anything African that is no longer in the directory is retired, not
   * removed. Deactivating takes it out of every dropdown while leaving the row
   * — and therefore every profile pointing at it — intact. Deleting would
   * either fail on the foreign key or silently blank a volunteer's church
   * details, and neither is acceptable for data somebody entered themselves.
   */
  const retiredProvinces = await db.churchProvince.updateMany({
    where: {
      isActive: true,
      id: { notIn: [...seenProvinceIds] },
      region: { continentId: africa?.id },
    },
    data: { isActive: false },
  })
  const retiredRegions = await db.churchRegion.updateMany({
    where: { isActive: true, continentId: africa?.id, id: { notIn: [...seenRegionIds] } },
    data: { isActive: false },
  })

  /*
   * International regions keep their own seed data — the directory covers
   * Nigeria only, and deactivating them would strip diaspora volunteers of any
   * way to say where they worship.
   */
  let internationalProvinces = 0
  for (const [index, region] of REGIONS.entries()) {
    if (region.continent === 'Africa') continue
    const continent = await db.churchContinent.findUnique({ where: { name: region.continent } })
    const saved = await db.churchRegion.upsert({
      where: { name: region.name },
      update: { continentId: continent?.id, sortOrder: 1000 + index },
      create: { name: region.name, continentId: continent?.id, sortOrder: 1000 + index },
    })

    for (const [pIndex, provinceName] of region.provinces.entries()) {
      await db.churchProvince.upsert({
        where: { regionId_name: { regionId: saved.id, name: provinceName } },
        update: { sortOrder: pIndex },
        create: { regionId: saved.id, name: provinceName, sortOrder: pIndex },
      })
      internationalProvinces++
    }
  }

  console.log(
    `  church regions: ${churchDirectory.length} Nigerian + international, ` +
      `provinces: ${provinceCount} + ${internationalProvinces}`,
  )
  if (retiredRegions.count || retiredProvinces.count) {
    console.log(
      `  retired (hidden, not deleted): ${retiredRegions.count} regions, ${retiredProvinces.count} provinces`,
    )
  }
}

async function seedLookups() {
  const sets: [LookupCategory, typeof OCCUPATIONS][] = [
    ['OCCUPATION', OCCUPATIONS],
    ['EDUCATION', EDUCATION_LEVELS],
    ['DISCOVERY_SOURCE', DISCOVERY_SOURCES],
  ]
  let total = 0
  for (const [category, options] of sets) {
    for (const [index, option] of options.entries()) {
      await db.lookupOption.upsert({
        where: { category_value: { category, value: option.value } },
        update: { label: option.label, requiresText: option.requiresText ?? false, sortOrder: index },
        create: {
          category,
          value: option.value,
          label: option.label,
          requiresText: option.requiresText ?? false,
          sortOrder: index,
        },
      })
      total++
    }
  }
  console.log(`  lookup options: ${total}`)
}

async function seedDepartments() {
  let questionCount = 0
  for (const [index, dept] of DEPARTMENTS.entries()) {
    const department = await db.department.upsert({
      where: { slug: dept.slug },
      update: { name: dept.name, description: dept.description, sortOrder: index },
      create: {
        slug: dept.slug,
        name: dept.name,
        description: dept.description,
        sortOrder: index,
      },
    })

    // First pass creates every question; the second pass wires up conditional
    // parents, which may point at a question defined later in the list.
    for (const [qIndex, q] of dept.questions.entries()) {
      const question = await db.departmentQuestion.upsert({
        where: { departmentId_key: { departmentId: department.id, key: q.key } },
        update: {
          label: q.label,
          helpText: q.helpText,
          type: q.type as QuestionType,
          isRequired: q.isRequired ?? false,
          sortOrder: qIndex,
          maxLength: q.maxLength,
          minValue: q.minValue,
          maxValue: q.maxValue,
          ratingMin: q.ratingMin,
          ratingMax: q.ratingMax,
          allowedMimeTypes: q.allowedMimeTypes ?? [],
          maxFileSizeKb: q.maxFileSizeKb,
          placeholder: q.placeholder,
          pattern: q.pattern,
          patternMessage: q.patternMessage,
        },
        create: {
          departmentId: department.id,
          key: q.key,
          label: q.label,
          helpText: q.helpText,
          type: q.type as QuestionType,
          isRequired: q.isRequired ?? false,
          sortOrder: qIndex,
          maxLength: q.maxLength,
          minValue: q.minValue,
          maxValue: q.maxValue,
          ratingMin: q.ratingMin,
          ratingMax: q.ratingMax,
          allowedMimeTypes: q.allowedMimeTypes ?? [],
          maxFileSizeKb: q.maxFileSizeKb,
          placeholder: q.placeholder,
          pattern: q.pattern,
          patternMessage: q.patternMessage,
        },
      })
      questionCount++

      for (const [oIndex, option] of (q.options ?? []).entries()) {
        await db.questionOption.upsert({
          where: { questionId_value: { questionId: question.id, value: option.value } },
          update: { label: option.label, requiresText: option.requiresText ?? false, sortOrder: oIndex },
          create: {
            questionId: question.id,
            value: option.value,
            label: option.label,
            requiresText: option.requiresText ?? false,
            sortOrder: oIndex,
          },
        })
      }
    }

    for (const q of dept.questions) {
      if (!q.parentKey) continue
      const parent = await db.departmentQuestion.findUnique({
        where: { departmentId_key: { departmentId: department.id, key: q.parentKey } },
      })
      if (!parent) throw new Error(`${dept.slug}: parent question "${q.parentKey}" not found for "${q.key}"`)
      await db.departmentQuestion.update({
        where: { departmentId_key: { departmentId: department.id, key: q.key } },
        data: { parentQuestionId: parent.id, parentOptionValues: q.parentOptionValues ?? [] },
      })
    }
  }
  console.log(`  departments: ${DEPARTMENTS.length}, questions: ${questionCount}`)
}

async function seedSettings() {
  const defaults: Record<string, unknown> = {
    registration_open: true,
    registration_closed_message:
      'Volunteer registration for MMPraise 2027 is currently closed. Please check back soon.',
    // Confirmed: 85 hours from 02:00 WAT on Monday 1 March 2027.
    event_name: "85 Hours Marathon Messiah's Praise 2027",
    event_dates: ['2027-03-01', '2027-03-02', '2027-03-03', '2027-03-04'],
    support_email: process.env.SUPPORT_EMAIL ?? 'volunteers@mmpraise.org',
    minor_age_ranges: ['AGE_00_15'],
  }
  for (const [key, value] of Object.entries(defaults)) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never },
    })
  }
  console.log(`  settings: ${Object.keys(defaults).length}`)
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@mmpraise.org').toLowerCase()
  const username = process.env.SEED_ADMIN_USERNAME ?? 'superadmin'
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026'

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`  super administrator already present (${email})`)
    return
  }

  const user = await db.user.create({
    data: {
      email,
      username,
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPER_ADMIN' }] },
    },
  })
  console.log(`  super administrator created: ${email} (id ${user.id})`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`  ⚠ default password is "${password}" — change it after first login`)
  }
}

async function main() {
  console.log('Seeding MMPraise volunteer database…')
  await seedCountries()
  await seedChurchHierarchy()
  await seedLookups()
  await seedDepartments()
  await seedSettings()
  await seedAdmin()
  console.log('Seed complete.')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
