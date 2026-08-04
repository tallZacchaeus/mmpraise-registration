import { NextResponse } from 'next/server'
import { eventConfig } from '@/config/site'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { getSessionUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/rbac'
import { buildWhere, type ApplicationFilters } from '@/lib/admin/queries'
import { getLookupOptions } from '@/lib/reference'
import { STATUS_LABELS } from '@/lib/applications/service'
import { formatDate } from '@/lib/utils'
import { AGE_RANGES, DENOMINATIONS } from '@/lib/validation/registration'

/**
 * Filtered export of volunteer applications as CSV or Excel.
 *
 * Applies the same scope filter as the on-screen list, so an export can never
 * widen what an administrator can see. Health information is deliberately
 * omitted from both formats — it is only ever viewed one record at a time,
 * through an audited action.
 *
 * Every export is recorded in the audit log with the filters used and the row count.
 */
const MAX_ROWS = 20_000

/**
 * Neutralise spreadsheet formula injection.
 * A cell beginning =, +, - or @ is executed by Excel when opened, so a value
 * such as `=HYPERLINK(...)` typed into a name field becomes a live formula.
 */
function safeCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`
  return value
}

function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const safe = safeCell(raw)
  return `"${safe.replace(/"/g, '""')}"`
}

const COLUMNS = [
  // The volunteer's permanent number leads, because it is the one they quote
  // and the one that joins this export to any other record of them.
  'MMP number',
  'Registration ID',
  'Status',
  'Submitted',
  'First name',
  'Last name',
  'Gender',
  'Age range',
  'Email',
  'Phone',
  'Country',
  'State/Province',
  'City',
  'Occupation',
  'Education',
  'Denomination',
  'RCCG region',
  'RCCG province',
  'Parish',
  'Department',
  'Available overnight',
  'Emergency contact',
  'Emergency phone',
  'How they heard about us',
] as const

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return new NextResponse('Unauthorised', { status: 401 })
  if (!can(user, 'application:export')) return new NextResponse('Forbidden', { status: 403 })

  const url = new URL(request.url)
  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'

  const filters: ApplicationFilters = {
    q: url.searchParams.get('q') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    departmentId: url.searchParams.get('departmentId') ?? undefined,
    countryId: url.searchParams.get('countryId') ?? undefined,
    stateId: url.searchParams.get('stateId') ?? undefined,
    churchRegionId: url.searchParams.get('churchRegionId') ?? undefined,
    churchProvinceId: url.searchParams.get('churchProvinceId') ?? undefined,
    ageRange: url.searchParams.get('ageRange') ?? undefined,
  }

  const where = buildWhere(user, filters)

  const applications = await db.volunteerApplication.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    take: MAX_ROWS,
    include: {
      participations: {
        where: { edition: eventConfig.edition },
        select: {
          availableOvernight: true,
          status: true,
          department: { select: { name: true } },
        },
      },
      emergency: true,
      user: {
        select: {
          email: true,
          phone: true,
          mmpCode: true,
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
    },
  })

  // Export human-readable labels, not internal lookup values.
  const [occupations, educations, discoveries] = await Promise.all([
    getLookupOptions('OCCUPATION'),
    getLookupOptions('EDUCATION'),
    getLookupOptions('DISCOVERY_SOURCE'),
  ])
  const labelFor = (options: { value: string; label: string }[], value: string | null | undefined) =>
    options.find((o) => o.value === value)?.label ?? value ?? ''

  const rows = applications.map((application) => {
    const profile = application.user.profile
    // At most one row: `(applicationId, edition)` is unique.
    const participation = application.participations[0]
    return [
      application.user.mmpCode ?? '',
      application.registrationId,
      STATUS_LABELS[application.status],
      application.submittedAt ? formatDate(application.submittedAt) : '',
      profile?.firstName ?? '',
      profile?.lastName ?? '',
      profile?.gender ?? '',
      AGE_RANGES.find((a) => a.value === profile?.ageRange)?.label ?? '',
      application.user.email,
      application.user.phone ?? '',
      profile?.country?.name ?? '',
      profile?.state?.name ?? profile?.stateNameOther ?? '',
      profile?.city ?? '',
      profile?.occupation === 'other'
        ? (profile.occupationOther ?? 'Other')
        : labelFor(occupations, profile?.occupation),
      profile?.education === 'other'
        ? (profile.educationOther ?? 'Other')
        : labelFor(educations, profile?.education),
      DENOMINATIONS.find((d) => d.value === profile?.denomination)?.label ?? '',
      profile?.region?.name ?? '',
      profile?.province?.name ?? '',
      profile?.parish?.name ?? profile?.parishNameOther ?? profile?.churchName ?? '',
      participation?.department?.name ?? '',
      participation?.availableOvernight == null
        ? ''
        : participation.availableOvernight
          ? 'Yes'
          : 'No',
      application.emergency ? `${application.emergency.name} (${application.emergency.relationship})` : '',
      application.emergency?.phone ?? '',
      application.discoverySource === 'other'
        ? (application.discoveryOther ?? 'Other')
        : labelFor(discoveries, application.discoverySource),
    ]
  })

  await audit({
    action: 'application.exported',
    entityType: 'VolunteerApplication',
    actorId: user.id,
    metadata: { format, rows: rows.length, filters },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `mmpraise-volunteers-${stamp}.${format}`

  if (format === 'csv') {
    const csv = [
      COLUMNS.map(csvEscape).join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ].join('\r\n')

    // The BOM makes Excel read the file as UTF-8 rather than the system codepage.
    return new NextResponse('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MMPraise Volunteer Registration'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Volunteers', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.addRow([...COLUMNS])
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF1E4' } }

  for (const row of rows) sheet.addRow(row.map((cell) => safeCell(String(cell ?? ''))))

  sheet.columns.forEach((column) => {
    let width = 12
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      width = Math.max(width, Math.min(40, String(cell.value ?? '').length + 2))
    })
    column.width = width
  })
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } }

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
