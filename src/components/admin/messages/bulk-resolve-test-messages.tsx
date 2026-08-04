'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { bulkResolveTestMessagesAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * Resolve every open message tagged as test data, in one counted confirmation
 * — the same contract as every bulk action on this platform.
 */
export function BulkResolveTestMessages({ count }: { count: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  function confirm() {
    setError(null)
    startTransition(async () => {
      const result = await bulkResolveTestMessagesAction(count)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone(result.data.resolved)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      {done !== null && (
        <Alert tone="success" title={`Resolved ${done} test message${done === 1 ? '' : 's'}`}>
          They stay under “Resolved”, so the tagging can be reviewed.
        </Alert>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" isLoading={pending}>
            <Trash2 aria-hidden className="size-4" />
            Resolve {count} test message{count === 1 ? '' : 's'}
          </Button>
        </DialogTrigger>
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogTitle>
            Resolve {count} tagged test message{count === 1 ? '' : 's'}?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-3 space-y-3 text-sm text-body">
              <p>
                Only open messages already tagged as test data are affected. Real messages are
                untouched even if they look similar.
              </p>
              <p>Nothing is deleted — resolved test messages stay visible under “Resolved”.</p>
            </div>
          </DialogDescription>
          {error && (
            <Alert tone="danger" title="Nothing was changed" className="mt-4">
              {error}
            </Alert>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <DialogClose asChild>
              <Button variant="ghost">Go back</Button>
            </DialogClose>
            <Button onClick={confirm} isLoading={pending}>
              Resolve {count}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
