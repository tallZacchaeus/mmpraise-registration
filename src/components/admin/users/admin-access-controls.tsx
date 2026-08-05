'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, CalendarOff, RotateCcw, ShieldCheck } from 'lucide-react'
import { setAdminAccessAction } from '@/app/(admin)/admin/manage-actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Field, TextInput } from '@/components/ui/form'

/**
 * Withdraw or restore one administrator's access.
 *
 * Two different things, deliberately not merged: a suspension carries an end
 * date and lapses by itself, which is what makes it safe for leave or an
 * investigation; disabling does not lapse and is the deliberate act. Neither
 * touches the volunteer side of the account.
 */
export function AdminAccessControls({
  userId,
  disabledAt,
  suspended,
  isSelf,
}: {
  userId: string
  disabledAt: Date | null
  /** Decided on the server: reading the clock during render is not pure. */
  suspended: boolean
  isSelf: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [until, setUntil] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  function run(action: 'suspend' | 'lift' | 'disable' | 'enable', success: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await setAdminAccessAction({ userId, action, until: until || null })
      if (!result.ok) {
        setMessage({ tone: 'danger', text: result.error })
        return
      }
      setMessage({ tone: 'success', text: success })
      setUntil('')
      router.refresh()
    })
  }

  if (isSelf) {
    return (
      <Alert tone="info">
        You cannot suspend or disable your own administrative access. Another administrator can.
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        {disabledAt ? (
          <Button
            variant="outline"
            isLoading={pending}
            onClick={() => run('enable', 'Administrative access restored.')}
          >
            <ShieldCheck aria-hidden className="size-4" />
            Restore access
          </Button>
        ) : (
          <Button
            variant="outline"
            isLoading={pending}
            onClick={() => run('disable', 'Administrative access disabled. It will not lapse on its own.')}
          >
            <Ban aria-hidden className="size-4" />
            Disable access
          </Button>
        )}

        {suspended && (
          <Button
            variant="outline"
            isLoading={pending}
            onClick={() => run('lift', 'Suspension lifted.')}
          >
            <RotateCcw aria-hidden className="size-4" />
            Lift suspension
          </Button>
        )}
      </div>

      {!disabledAt && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-line pt-4"
          onSubmit={(event) => {
            event.preventDefault()
            run('suspend', 'Suspended. Access returns by itself on that date.')
          }}
        >
          <Field label="Suspend until" htmlFor="suspend-until">
            <TextInput
              id="suspend-until"
              type="datetime-local"
              value={until}
              onChange={(event) => setUntil(event.target.value)}
            />
          </Field>
          <Button type="submit" variant="secondary" isLoading={pending} disabled={!until}>
            <CalendarOff aria-hidden className="size-4" />
            Suspend
          </Button>
          <p className="w-full text-xs text-muted">
            Access returns automatically on that date — no diary note needed. Their volunteer
            account is unaffected throughout.
          </p>
        </form>
      )}
    </div>
  )
}
