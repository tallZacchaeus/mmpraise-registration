'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CopyPlus } from 'lucide-react'
import { copyQuestionsAction } from '@/app/(admin)/admin/manage-actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Field, SelectInput } from '@/components/ui/form'

/**
 * Copy another department's question set into this one.
 *
 * Copies arrive retired, so a volunteer never meets a half-copied form; the
 * administrator restores the ones they actually want. Keys already here are
 * skipped, which makes running it twice harmless.
 */
export function CopyQuestions({
  departmentId,
  departments,
}: {
  departmentId: string
  departments: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [from, setFrom] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await copyQuestionsAction(from, departmentId)
      if (!result.ok) {
        setMessage({ tone: 'danger', text: result.error })
        return
      }
      setMessage({
        tone: 'success',
        text: `Copied ${result.data.copied} question${result.data.copied === 1 ? '' : 's'}${
          result.data.skipped ? `, skipped ${result.data.skipped} already here` : ''
        }. They are retired until you restore them.`,
      })
      router.refresh()
    })
  }

  if (departments.length === 0) return null

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      {message && (
        <Alert tone={message.tone} className="w-full">
          {message.text}
        </Alert>
      )}
      <Field label="Copy questions from" htmlFor="copy-from" className="min-w-56 flex-1">
        <SelectInput
          id="copy-from"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        >
          <option value="">Choose a department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Button type="submit" variant="secondary" isLoading={pending} disabled={!from}>
        <CopyPlus aria-hidden className="size-4" />
        Copy
      </Button>
    </form>
  )
}
