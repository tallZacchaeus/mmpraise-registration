'use client'

import { useState, useTransition } from 'react'
import { Plus, Save } from 'lucide-react'
import { deactivateReferenceAction, saveReferenceAction } from '@/app/(admin)/admin/manage-actions'
import { Alert, Badge, Button, Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { Field, SelectInput, TextInput } from '@/components/ui/form'
import type { FieldErrors } from '@/lib/actions/result'

type Item = { id: string; name: string; parentId?: string | null; isActive: boolean }
type Kind = 'region' | 'province' | 'parish'

const LABELS: Record<Kind, { singular: string; plural: string; parent?: string }> = {
  region: { singular: 'Region', plural: 'RCCG regions' },
  province: { singular: 'Province', plural: 'RCCG provinces', parent: 'Region' },
  parish: { singular: 'Parish', plural: 'Parishes', parent: 'Province' },
}

/**
 * Reference-data editor for the RCCG hierarchy.
 * Records are deactivated rather than deleted, so profiles that already point at
 * them continue to display correctly.
 */
export function ReferenceManager({
  regions,
  provinces,
  parishes,
}: {
  regions: Item[]
  provinces: Item[]
  parishes: Item[]
}) {
  const [kind, setKind] = useState<Kind>('region')
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const items = kind === 'region' ? regions : kind === 'province' ? provinces : parishes
  const parents = kind === 'province' ? regions : kind === 'parish' ? provinces : []

  function reset() {
    setName('')
    setParentId('')
    setEditingId(null)
    setErrors({})
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const result = await saveReferenceAction({
        kind,
        id: editingId ?? undefined,
        name,
        parentId: parentId || null,
        isActive: true,
      })

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setMessage({ tone: 'danger', text: result.error })
        return
      }
      reset()
      setMessage({ tone: 'success', text: `${LABELS[kind].singular} saved.` })
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card>
        <CardHeader title={editingId ? `Edit ${LABELS[kind].singular.toLowerCase()}` : `Add ${LABELS[kind].singular.toLowerCase()}`} />
        <CardBody>
          <form onSubmit={save} className="space-y-5">
            {message && <Alert tone={message.tone}>{message.text}</Alert>}

            <Field label="Record type" htmlFor="ref-kind" required>
              <SelectInput
                id="ref-kind"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as Kind)
                  reset()
                }}
              >
                <option value="region">RCCG region</option>
                <option value="province">RCCG province</option>
                <option value="parish">Parish</option>
              </SelectInput>
            </Field>

            {LABELS[kind].parent && (
              <Field label={LABELS[kind].parent!} htmlFor="ref-parent" required error={errors.parentId}>
                <SelectInput
                  id="ref-parent"
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                  placeholder={`Choose a ${LABELS[kind].parent!.toLowerCase()}`}
                >
                  {parents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}

            <Field label="Name" htmlFor="ref-name" required error={errors.name}>
              <TextInput
                id="ref-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                invalid={Boolean(errors.name)}
              />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" isLoading={pending}>
                {!pending && (editingId ? <Save aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />)}
                {editingId ? 'Save changes' : `Add ${LABELS[kind].singular.toLowerCase()}`}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={reset}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={LABELS[kind].plural} description={`${items.length} record${items.length === 1 ? '' : 's'}.`} />
        <CardBody>
          {items.length === 0 ? (
            <p className="text-sm text-muted">Nothing here yet.</p>
          ) : (
            <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-field border border-line px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                    {item.parentId && (
                      <span className="block truncate text-xs text-muted">
                        {parents.find((p) => p.id === item.parentId)?.name ?? ''}
                      </span>
                    )}
                  </span>

                  <span className="flex items-center gap-2">
                    {!item.isActive && <Badge tone="neutral">Inactive</Badge>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(item.id)
                        setName(item.name)
                        setParentId(item.parentId ?? '')
                      }}
                    >
                      Edit
                    </Button>
                    {item.isActive && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        isLoading={pending}
                        onClick={() =>
                          startTransition(async () => void (await deactivateReferenceAction(kind, item.id)))
                        }
                      >
                        Deactivate
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
