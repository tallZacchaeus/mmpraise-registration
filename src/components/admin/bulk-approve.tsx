'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'
import { bulkApproveAction } from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TextArea } from '@/components/ui/form'

/**
 * Approve everything reviewable in the current view.
 *
 * The button names the number; the dialog repeats it and explains the blast
 * radius; the server re-counts and refuses if the queue moved. Approval is a
 * one-time judgement about a person under this platform's model, so the wording
 * says "volunteers", not "applications" — that is what is being decided.
 */
export function BulkApprove({
  reviewableCount,
  filters,
}: {
  /** SUBMITTED + UNDER_REVIEW rows matching the current filters. */
  reviewableCount: number
  filters: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ approved: number; remaining: number } | null>(null)

  if (reviewableCount === 0 && !done) return null

  function confirm() {
    setError(null)
    startTransition(async () => {
      const result = await bulkApproveAction({
        filters: {
          q: filters.q,
          status: filters.status,
          departmentId: filters.departmentId,
          countryId: filters.countryId,
          churchRegionId: filters.churchRegionId,
          ageRange: filters.ageRange,
        },
        expectedCount: reviewableCount,
        reason: reason || undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDone(result.data)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      {done && (
        <Alert tone="success" title={`Approved ${done.approved} volunteer${done.approved === 1 ? '' : 's'}`}>
          Each has a status-history entry and an audit record of its own.
          {done.remaining > 0 &&
            ` ${done.remaining} remain — the batch is capped at 500 per run; press it again for the rest.`}
        </Alert>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setError(null)
        }}
      >
        {reviewableCount > 0 && (
          <DialogTrigger asChild>
            <Button size="sm" isLoading={pending}>
              <CheckCheck aria-hidden className="size-4" />
              Approve all {reviewableCount}
            </Button>
          </DialogTrigger>
        )}
        {/*
          Auto-focus is suppressed. Radix would focus the first tabbable —
          the optional note textarea — which reads the wrong thing to a screen
          reader (an input, before the question it belongs to) and, on phones,
          makes the browser scroll the focused field into view and shove the
          fixed dialog off-screen. With nothing focused, assistive technology
          announces the dialog by its title: the counted question itself.
        */}
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogTitle>
            Approve {reviewableCount} volunteer{reviewableCount === 1 ? '' : 's'}?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-3 space-y-3 text-sm text-body">
              <p>
                Every application in this view that is submitted or under review becomes approved.
                Already-decided applications are not touched, whatever the filters say.
              </p>
              <p>
                Approval is one-time: these volunteers will not be reviewed again in future
                editions. Each decision is recorded individually against the volunteer.
              </p>
            </div>
          </DialogDescription>

          {error && (
            <Alert tone="danger" title="Nothing was changed" className="mt-4">
              {error}
            </Alert>
          )}

          <div className="mt-4">
            <label htmlFor="bulk-reason" className="block text-sm font-semibold text-ink">
              Note to include{' '}
              <span className="font-normal text-muted">(optional, shown to each volunteer)</span>
            </label>
            <TextArea
              id="bulk-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
              placeholder="Welcome to the team — briefing details follow by email."
              className="mt-2"
            />
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <DialogClose asChild>
              <Button variant="ghost">Go back</Button>
            </DialogClose>
            <Button onClick={confirm} isLoading={pending}>
              Approve {reviewableCount}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
