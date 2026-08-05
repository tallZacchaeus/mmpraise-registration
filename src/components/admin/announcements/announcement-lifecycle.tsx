'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, CalendarClock, Copy, EyeOff, Mail, Megaphone, RotateCcw } from 'lucide-react'
import {
  archiveAnnouncementAction,
  cloneAnnouncementAction,
  expireAnnouncementAction,
  publishAnnouncementAction,
  scheduleAnnouncementAction,
  sendAnnouncementTestEmailAction,
} from '@/app/(admin)/admin/actions'
import { Alert, Button } from '@/components/ui/primitives'
import { Checkbox, Field, TextInput } from '@/components/ui/form'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * Everything that changes *when* an announcement is live.
 *
 * Kept apart from the editor so saving a wording fix can never publish, and
 * publishing always states who will see it — `audienceCount` is computed
 * server-side from the same query the email run uses.
 */
export function AnnouncementLifecycle({
  id,
  status,
  audienceLabel,
  audienceCount,
  canEmail,
}: {
  id: string
  status: string
  audienceLabel: string
  audienceCount: number
  canEmail: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [publishOpen, setPublishOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setMessage({ tone: 'danger', text: result.error ?? 'That did not work' })
        return
      }
      if (success) setMessage({ tone: 'success', text: success })
      router.refresh()
    })
  }

  function publish() {
    setMessage(null)
    startTransition(async () => {
      const result = await publishAnnouncementAction(id, { sendEmail })
      setPublishOpen(false)
      if (!result.ok) {
        setMessage({ tone: 'danger', text: result.error })
        return
      }
      setMessage({
        tone: 'success',
        text: result.data.recipients
          ? `Published, and ${result.data.recipients} volunteer${result.data.recipients === 1 ? '' : 's'} notified by email${result.data.failed ? ` — ${result.data.failed} failed, see delivery history` : ''}.`
          : 'Published. It is on volunteer dashboards now.',
      })
      setSendEmail(false)
      router.refresh()
    })
  }

  const canPublish = status === 'DRAFT' || status === 'SCHEDULED' || status === 'EXPIRED'

  return (
    <div className="space-y-4">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        {canPublish && (
          <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
            <DialogTrigger asChild>
              <Button isLoading={pending}>
                <Megaphone aria-hidden className="size-4" />
                Publish now
              </Button>
            </DialogTrigger>
            <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
              <DialogTitle>Publish this announcement?</DialogTitle>
              <DialogDescription asChild>
                <div className="mt-3 space-y-3 text-sm text-body">
                  <p>
                    It goes live immediately for <strong>{audienceLabel}</strong> —{' '}
                    {audienceCount} volunteer{audienceCount === 1 ? '' : 's'} today.
                  </p>
                </div>
              </DialogDescription>
              {canEmail && (
                <div className="mt-4">
                  <Checkbox
                    checked={sendEmail}
                    onChange={setSendEmail}
                    label={`Also notify all ${audienceCount} by email`}
                    description="The email carries the title and a short preview only — the full announcement is read signed in, on the dashboard."
                  />
                </div>
              )}
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <DialogClose asChild>
                  <Button variant="ghost">Go back</Button>
                </DialogClose>
                <Button onClick={publish} isLoading={pending}>
                  {sendEmail ? 'Publish and email' : 'Publish'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {(status === 'PUBLISHED' || status === 'SCHEDULED') && (
          <Button
            variant="outline"
            isLoading={pending}
            onClick={() =>
              run(
                () => expireAnnouncementAction(id),
                'Taken down. Volunteers no longer see it.',
              )
            }
          >
            <EyeOff aria-hidden className="size-4" />
            Take down now
          </Button>
        )}

        {status !== 'ARCHIVED' && status !== 'PUBLISHED' && (
          <Button
            variant="outline"
            isLoading={pending}
            onClick={() => run(() => archiveAnnouncementAction(id, true), 'Archived.')}
          >
            <Archive aria-hidden className="size-4" />
            Archive
          </Button>
        )}

        {status === 'ARCHIVED' && (
          <Button
            variant="outline"
            isLoading={pending}
            onClick={() => run(() => archiveAnnouncementAction(id, false), 'Restored as a draft.')}
          >
            <RotateCcw aria-hidden className="size-4" />
            Restore to draft
          </Button>
        )}

        <Button
          variant="outline"
          isLoading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cloneAnnouncementAction(id)
              if (!result.ok) {
                setMessage({ tone: 'danger', text: result.error })
                return
              }
              router.push(`/admin/announcements/${result.data.id}`)
            })
          }
        >
          <Copy aria-hidden className="size-4" />
          Clone
        </Button>

        {canEmail && (
          <Button
            variant="outline"
            isLoading={pending}
            onClick={() =>
              run(
                () => sendAnnouncementTestEmailAction(id),
                'Test email sent to your own address.',
              )
            }
          >
            <Mail aria-hidden className="size-4" />
            Email me a test
          </Button>
        )}
      </div>

      {canPublish && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-line pt-4"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => scheduleAnnouncementAction(id, scheduledFor), 'Scheduled.')
          }}
        >
          <Field label="Or schedule it for" htmlFor="announcement-schedule">
            <TextInput
              id="announcement-schedule"
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
          </Field>
          <Button type="submit" variant="secondary" isLoading={pending} disabled={!scheduledFor}>
            <CalendarClock aria-hidden className="size-4" />
            Schedule
          </Button>
          <p className="w-full text-xs text-muted">
            A scheduled announcement appears on dashboards from that moment. Email does not send
            for scheduled announcements yet — publish immediately if it must be emailed.
          </p>
        </form>
      )}
    </div>
  )
}
