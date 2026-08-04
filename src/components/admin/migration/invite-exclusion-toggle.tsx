'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setInviteExclusionAction } from '@/app/(admin)/admin/previous-participants/actions'

/**
 * Leave one person out of the invitation run, or put them back in.
 *
 * A plain button rather than a checkbox: this performs an action on the server
 * rather than setting a value in a form, and a checkbox that silently saves is
 * the control people misread. The accessible name names the person, so a screen
 * reader user tabbing a table of two hundred rows knows which one they are on.
 */
export function InviteExclusionToggle({
  recordId,
  excluded,
  personLabel,
}: {
  recordId: string
  excluded: boolean
  /** The email address, used only to make the button's name unambiguous. */
  personLabel: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setError(null)
    startTransition(async () => {
      const result = await setInviteExclusionAction(recordId, !excluded)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-primary underline underline-offset-4 hover:text-primary-hover disabled:opacity-60"
      >
        {excluded ? 'Include in invitations' : 'Exclude from invitations'}
        <span className="sr-only"> — {personLabel}</span>
      </button>
      {error && (
        <span role="alert" className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </>
  )
}
