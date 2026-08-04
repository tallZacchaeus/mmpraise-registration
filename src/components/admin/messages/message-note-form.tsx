'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquarePlus } from 'lucide-react'
import { addContactNoteAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { TextArea } from '@/components/ui/form'

/** Add to the message's note timeline without touching its status. */
export function MessageNoteForm({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await addContactNoteAction(id, body)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setBody('')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <label htmlFor="message-note" className="block text-sm font-semibold text-ink">
        Add a note
      </label>
      <TextArea
        id="message-note"
        rows={2}
        maxLength={1000}
        value={body}
        onChange={(event) => setBody(event.currentTarget.value)}
        placeholder="What you checked, who you asked, what was promised."
      />
      <Button type="submit" size="sm" variant="secondary" isLoading={pending} disabled={!body.trim()}>
        <MessageSquarePlus aria-hidden className="size-4" />
        Add note
      </Button>
    </form>
  )
}
