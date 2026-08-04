'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, ShieldAlert } from 'lucide-react'
import {
  saveMappingAction,
  validateBatchAction,
} from '@/app/(admin)/admin/previous-participants/actions'
import { Alert, Badge, Button } from '@/components/ui/primitives'
import { SelectInput } from '@/components/ui/form'
import { MIGRATION_FIELDS, isForbiddenHeader, type MigrationField } from '@/lib/migration/csv'

/**
 * Step two: say what each column in the file means.
 *
 * A guess is offered for every header so the common case is confirmation rather
 * than data entry, but nothing is assumed — an unmapped column is simply
 * ignored, which is safer than importing a column into a field it does not
 * belong in.
 *
 * Columns whose names look like credentials are shown, locked and explained.
 * Hiding them would leave an administrator wondering why their file "lost" a
 * column; offering them would let somebody map a password hash into a name.
 */
export function ColumnMapping({
  batchId,
  headers,
  sample,
  initialMapping,
  editable,
}: {
  batchId: string
  headers: string[]
  /** The first few rows, to show what is actually in each column. */
  sample: Record<string, string>[]
  initialMapping: Record<string, MigrationField | ''>
  /** False once the batch has been queued — the mapping is then fixed. */
  editable: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mapping, setMapping] = useState<Record<string, MigrationField | ''>>(initialMapping)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const forbidden = useMemo(() => headers.filter(isForbiddenHeader), [headers])

  /** A field may only be used once; the rest are disabled in every other row. */
  const usedFields = useMemo(() => {
    const counts = new Map<string, number>()
    for (const value of Object.values(mapping)) {
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return counts
  }, [mapping])

  const emailMapped = Object.values(mapping).includes('email')

  function update(header: string, value: string) {
    setSaved(false)
    setMapping((current) => ({ ...current, [header]: (value || '') as MigrationField | '' }))
  }

  function save(thenValidate: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await saveMappingAction(batchId, mapping)
      if (!result.ok) {
        setError(result.fieldErrors?.mapping ?? result.error)
        return
      }
      setSaved(true)

      if (thenValidate) {
        const validated = await validateBatchAction(batchId)
        if (!validated.ok) {
          setError(validated.error)
          return
        }
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {forbidden.length > 0 && (
        <Alert
          tone="warning"
          title="Some columns look like credentials and will not be read"
          icon={<ShieldAlert className="size-5" />}
        >
          {forbidden.join(', ')}. Passwords are never imported: a hash from another system has
          unknown strength, and a plaintext column means the source file is already a breach.
        </Alert>
      )}

      {error && (
        <Alert tone="danger" title="The mapping could not be saved">
          {error}
        </Alert>
      )}

      {saved && !error && (
        <Alert tone="success" title="Mapping saved">
          Nothing has been imported. Validate to see what would happen.
        </Alert>
      )}

      {!emailMapped && (
        <Alert tone="warning" title="Map the email column" icon={<AlertTriangle className="size-5" />}>
          Email address is how a row is matched to an existing account. Without it nothing can be
          imported safely.
        </Alert>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="sr-only">
            Each column in the uploaded file, an example of its contents, and the field it will be
            imported into.
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-3 py-2 font-display text-xs uppercase tracking-wide text-muted">
                Column in your file
              </th>
              <th scope="col" className="px-3 py-2 font-display text-xs uppercase tracking-wide text-muted">
                Example
              </th>
              <th scope="col" className="px-3 py-2 font-display text-xs uppercase tracking-wide text-muted">
                Import as
              </th>
            </tr>
          </thead>
          <tbody>
            {headers.map((header) => {
              const locked = isForbiddenHeader(header)
              const value = mapping[header] ?? ''
              const example = sample.map((row) => row[header]).find((v) => v && v.length > 0) ?? ''
              const controlId = `map-${header.replace(/[^a-zA-Z0-9]/g, '-')}`

              return (
                <tr key={header} className="border-b border-line last:border-0">
                  <th scope="row" className="px-3 py-3 text-left align-top font-medium text-ink">
                    {header}
                    {locked && (
                      <Badge tone="danger" className="ml-2">
                        Never imported
                      </Badge>
                    )}
                  </th>
                  <td className="max-w-[16rem] truncate px-3 py-3 align-top text-muted">
                    {locked ? <span className="italic">not read</span> : example || '—'}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {locked ? (
                      <span className="text-sm text-muted">Ignored</span>
                    ) : (
                      <>
                        <label htmlFor={controlId} className="sr-only">
                          Import the column “{header}” as
                        </label>
                        <SelectInput
                          id={controlId}
                          value={value}
                          disabled={!editable || pending}
                          onChange={(event) => update(header, event.currentTarget.value)}
                          className="min-w-[13rem]"
                        >
                          <option value="">Do not import</option>
                          {MIGRATION_FIELDS.map((field) => (
                            <option
                              key={field.key}
                              value={field.key}
                              // Already taken by another column. Two columns
                              // into one field would silently discard one.
                              disabled={value !== field.key && (usedFields.get(field.key) ?? 0) > 0}
                            >
                              {field.label}
                              {'required' in field && field.required ? ' (required)' : ''}
                            </option>
                          ))}
                        </SelectInput>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => save(true)} isLoading={pending} disabled={!emailMapped}>
            <Check aria-hidden className="size-4" />
            Save and validate
          </Button>
          <Button variant="outline" onClick={() => save(false)} isLoading={pending}>
            Save mapping only
          </Button>
          <p className="text-sm text-muted">Validating writes nothing to volunteer records.</p>
        </div>
      )}
    </div>
  )
}
