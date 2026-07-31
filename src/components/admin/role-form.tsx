'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck } from 'lucide-react'
import { updateUserRolesAction } from '@/app/(admin)/admin/manage-actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Checkbox, Field, TextInput } from '@/components/ui/form'
import { ROLE_LABELS } from '@/lib/auth/roles'
import type { FieldErrors } from '@/lib/actions/result'
import type { Role } from '@/generated/prisma/enums'

const ASSIGNABLE: Role[] = [
  'REGISTRATION_ADMIN',
  'DEPARTMENT_HEAD',
  'REVIEWER',
  'MEDICAL_INFO_OFFICER',
  'COMMUNICATION_OFFICER',
  'SUPER_ADMIN',
]

const DESCRIPTIONS: Partial<Record<Role, string>> = {
  REGISTRATION_ADMIN: 'Full access to applications, exports, settings and reference data.',
  DEPARTMENT_HEAD: 'Sees only the departments selected below.',
  REVIEWER: 'Can read applications and add notes, but cannot decide outcomes.',
  MEDICAL_INFO_OFFICER: 'The only role that can view declared health information.',
  COMMUNICATION_OFFICER: 'Can email volunteers and publish announcements.',
  SUPER_ADMIN: 'Unrestricted access, including user management.',
}

export function RoleForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const result = await updateUserRolesAction({ email, roles, departmentIds })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setMessage({ tone: 'danger', text: result.error })
        return
      }
      setErrors({})
      setMessage({ tone: 'success', text: `Roles updated for ${email}.` })
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <Field
        label="Volunteer email address"
        htmlFor="role-email"
        required
        error={errors.email}
        help="The person must already have a volunteer account."
      >
        <TextInput
          id="role-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          invalid={Boolean(errors.email)}
        />
      </Field>

      <Field label="Roles" asFieldset>
        <div className="space-y-2">
          {ASSIGNABLE.map((role) => (
            <Checkbox
              key={role}
              checked={roles.includes(role)}
              onChange={(checked) =>
                setRoles((current) => (checked ? [...current, role] : current.filter((r) => r !== role)))
              }
              label={ROLE_LABELS[role]}
              description={DESCRIPTIONS[role]}
            />
          ))}
        </div>
      </Field>

      {roles.includes('DEPARTMENT_HEAD') && (
        <Field label="Departments this person leads" asFieldset required>
          <div className="grid gap-2 sm:grid-cols-2">
            {departments.map((department) => (
              <Checkbox
                key={department.id}
                checked={departmentIds.includes(department.id)}
                onChange={(checked) =>
                  setDepartmentIds((current) =>
                    checked ? [...current, department.id] : current.filter((id) => id !== department.id),
                  )
                }
                label={department.name}
              />
            ))}
          </div>
        </Field>
      )}

      <Alert tone="warning">
        Saving replaces every administrative role this person currently holds. Their volunteer access is
        never removed.
      </Alert>

      <Button type="submit" isLoading={pending}>
        {!pending && <ShieldCheck aria-hidden className="size-4" />}
        Update roles
      </Button>
    </form>
  )
}
