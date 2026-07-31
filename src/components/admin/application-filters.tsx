'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button, Spinner } from '@/components/ui/primitives'
import { SelectInput } from '@/components/ui/form'
import { STATUS_LABELS } from '@/lib/applications/status'
import { AGE_RANGES } from '@/lib/validation/registration'
import type { ApplicationStatus } from '@/generated/prisma/enums'

type Option = { id: string; name: string }

/**
 * Filter bar for the applicant table.
 *
 * State lives in the URL so a filtered view can be bookmarked, shared with a
 * colleague, and used by the export links without a second source of truth.
 * The free-text search is debounced to avoid a query per keystroke.
 */
const STATUSES: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'WAITLISTED',
  'REJECTED',
  'ASSIGNED',
  'CHECKED_IN',
  'COMPLETED',
]

export function ApplicationFilters({
  departments,
  countries,
  regions,
}: {
  departments: Option[]
  countries: Option[]
  regions: Option[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const firstRender = useRef(true)

  const current = useMemo(
    () => ({
      status: searchParams.get('status') ?? 'all',
      departmentId: searchParams.get('departmentId') ?? 'all',
      countryId: searchParams.get('countryId') ?? 'all',
      churchRegionId: searchParams.get('churchRegionId') ?? 'all',
      ageRange: searchParams.get('ageRange') ?? 'all',
    }),
    [searchParams],
  )

  function apply(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (!value || value === 'all') params.delete(key)
      else params.set(key, value)
    }
    // Any filter change invalidates the current page number.
    params.delete('page')
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => apply({ q: query }), 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const hasFilters =
    query || Object.values(current).some((value) => value !== 'all')

  return (
    <div className="space-y-4 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <label htmlFor="admin-search" className="mb-1 block text-sm font-semibold text-ink">
            Search
          </label>
          <div className="relative">
            <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="admin-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email, phone or registration ID"
              className="min-h-11 w-full rounded-field border border-line-strong bg-surface pl-9 pr-3 text-base text-body placeholder:text-muted/70 focus:border-primary"
            />
          </div>
        </div>

        {pending && <Spinner className="mb-3 size-4 text-primary" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Filter label="Status" id="filter-status" value={current.status} onChange={(v) => apply({ status: v })}>
          <option value="all">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Filter>

        <Filter
          label="Department"
          id="filter-department"
          value={current.departmentId}
          onChange={(v) => apply({ departmentId: v })}
        >
          <option value="all">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Filter>

        <Filter label="Country" id="filter-country" value={current.countryId} onChange={(v) => apply({ countryId: v })}>
          <option value="all">All countries</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </Filter>

        <Filter
          label="RCCG region"
          id="filter-region"
          value={current.churchRegionId}
          onChange={(v) => apply({ churchRegionId: v })}
        >
          <option value="all">All regions</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </Filter>

        <Filter label="Age range" id="filter-age" value={current.ageRange} onChange={(v) => apply({ ageRange: v })}>
          <option value="all">All ages</option>
          {AGE_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </Filter>
      </div>

      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery('')
            startTransition(() => router.replace(pathname, { scroll: false }))
          }}
        >
          <X aria-hidden className="size-4" />
          Clear filters
        </Button>
      )}
    </div>
  )
}

function Filter({
  label,
  id,
  value,
  onChange,
  children,
}: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
        {label}
      </label>
      <SelectInput id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </SelectInput>
    </div>
  )
}
