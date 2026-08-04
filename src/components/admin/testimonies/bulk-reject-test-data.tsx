'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { bulkRejectTestDataAction } from '@/app/(admin)/admin/actions'
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
 * Clear the pending queue of everything tagged as test data, in one counted
 * confirmation. Tagging is the human judgement; this is just the broom — and
 * the server re-counts before sweeping, so "reject the 97 I just read about"
 * can never silently become rejecting more.
 */
export function BulkRejectTestData({ count }: { count: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  function confirm() {
    setError(null)
    startTransition(async () => {
      const result = await bulkRejectTestDataAction(count)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone(result.data.rejected)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      {done !== null && (
        <Alert tone="success" title={`Rejected ${done} test submission${done === 1 ? '' : 's'}`}>
          They stay on the “Not published” tab, so the tagging can be reviewed.
        </Alert>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" isLoading={pending}>
            <Trash2 aria-hidden className="size-4" />
            Reject {count} test submission{count === 1 ? '' : 's'}
          </Button>
        </DialogTrigger>
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogTitle>
            Reject {count} tagged test submission{count === 1 ? '' : 's'}?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-3 space-y-3 text-sm text-body">
              <p>
                Only pending submissions already tagged as test data are affected. Real submissions
                are untouched even if they look similar.
              </p>
              <p>Nothing is deleted — rejected test data remains visible under “Not published”.</p>
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
              Reject {count}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
