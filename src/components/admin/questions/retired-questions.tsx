'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2 } from 'lucide-react'
import { setQuestionActiveAction } from '@/app/(admin)/admin/manage-actions'
import { Alert, Badge, Button } from '@/components/ui/primitives'

/**
 * Questions that are no longer asked.
 *
 * A question with answers is retired rather than deleted, so the answers
 * volunteers already gave survive. Without this list those questions were
 * invisible — retiring one by mistake meant a database edit to undo. Copied
 * question sets land here too, waiting to be turned on deliberately.
 */
export function RetiredQuestions({
  questions,
}: {
  questions: { id: string; label: string; key: string; answers: number }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function restore(id: string) {
    setError(null)
    startTransition(async () => {
      const result = await setQuestionActiveAction(id, true)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted">Nothing retired.</p>
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <ul className="space-y-2">
        {questions.map((question) => (
          <li
            key={question.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-line p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{question.label}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <code className="rounded bg-surface-sunken px-1.5 py-0.5">{question.key}</code>
                {question.answers > 0 && (
                  <Badge tone="neutral">
                    {question.answers} answer{question.answers === 1 ? '' : 's'} kept
                  </Badge>
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={pending}
              onClick={() => restore(question.id)}
            >
              <Undo2 aria-hidden className="size-4" />
              Ask this again
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
