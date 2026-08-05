'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setAdminPermissionAction } from '@/app/(admin)/admin/manage-actions'
import { Alert, Badge } from '@/components/ui/primitives'

export type PermissionRow = {
  permission: string
  /** What the roles alone would give. */
  fromRole: boolean
  /** The override, if one exists. */
  override: boolean | null
  /** What actually applies right now. */
  effective: boolean
}

const STATES = [
  { value: 'default', label: 'Role default' },
  { value: 'grant', label: 'Always allow' },
  { value: 'revoke', label: 'Never allow' },
] as const

/**
 * The effective permission policy for one administrator, and the controls to
 * change it.
 *
 * Three columns rather than a checkbox, because "allowed" and "allowed because
 * of their role" are different facts: withdrawing something a role grants is
 * an override that must survive the role being reassigned, and a checkbox
 * cannot say that.
 */
export function PermissionMatrix({
  userId,
  rows,
  disabled,
}: {
  userId: string
  rows: PermissionRow[]
  disabled?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function change(permission: string, state: string) {
    setError(null)
    startTransition(async () => {
      const result = await setAdminPermissionAction({ userId, permission, state })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {disabled && <Alert tone="info">{disabled}</Alert>}

      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Permission
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Now
              </th>
              <th scope="col" className="py-2 font-semibold">
                Setting
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const state = row.override === null ? 'default' : row.override ? 'grant' : 'revoke'
              return (
                <tr key={row.permission}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <code className="text-xs text-body">{row.permission}</code>
                  </th>
                  <td className="py-2 pr-3">
                    {row.effective ? (
                      <Badge tone={row.override === true ? 'info' : 'success'}>
                        {row.override === true ? 'Allowed (added)' : 'Allowed'}
                      </Badge>
                    ) : (
                      <Badge tone={row.override === false ? 'danger' : 'neutral'}>
                        {row.override === false ? 'Blocked' : 'Not allowed'}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2">
                    <label className="sr-only" htmlFor={`perm-${row.permission}`}>
                      {row.permission}
                    </label>
                    <select
                      id={`perm-${row.permission}`}
                      value={state}
                      disabled={pending || Boolean(disabled)}
                      onChange={(event) => change(row.permission, event.target.value)}
                      className="min-h-11 rounded-field border border-line-strong bg-surface px-3 py-1.5 text-sm"
                    >
                      {STATES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                          {option.value === 'default'
                            ? row.fromRole
                              ? ' (allowed)'
                              : ' (not allowed)'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
