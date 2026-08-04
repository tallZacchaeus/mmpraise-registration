'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquarePlus } from 'lucide-react'
import { addTestimonyNoteAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { TextArea } from '@/components/ui/form'

/** Add to the moderation timeline without touching the status. */
export function TestimonyNoteForm({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await addTestimonyNoteAction(id, body)
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
      <label htmlFor="testimony-note" className="block text-sm font-semibold text-ink">
        Add a note
      </label>
      <TextArea
        id="testimony-note"
        rows={2}
        maxLength={1000}
        value={body}
        onChange={(event) => setBody(event.currentTarget.value)}
        placeholder="Context for the next moderator — what you checked, who you asked."
      />
      <Button type="submit" size="sm" variant="secondary" isLoading={pending} disabled={!body.trim()}>
        <MessageSquarePlus aria-hidden className="size-4" />
        Add note
      </Button>
    </form>
  )
}
