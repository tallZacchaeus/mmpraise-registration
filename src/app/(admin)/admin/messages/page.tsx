import type { Metadata } from 'next'
import Link from 'next/link'
import { ContactMessageActions } from '@/components/admin/contact-message-actions'
import {
  Badge,
  buttonClass,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
} from '@/components/ui/primitives'
import { contactCategories } from '@/content/contact'
import { requirePermission } from '@/lib/auth/rbac'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import type { ContactStatus } from '@/generated/prisma/enums'

export const metadata: Metadata = { title: 'Contact messages' }

const TABS: { value: ContactStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
]

const TONES: Record<ContactStatus, 'warning' | 'neutral' | 'success'> = {
  NEW: 'warning',
  IN_PROGRESS: 'neutral',
  RESOLVED: 'success',
}

const CATEGORY_LABELS = new Map(contactCategories.map((c) => [c.value, c.label]))

/**
 * Inbox for messages sent from the public contact page.
 *
 * This is the only place a contact message can be read — nothing submitted
 * through that form is ever rendered on the public site.
 */
export default async function ContactMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requirePermission('application:review')
  const params = await searchParams

  const status = (TABS.find((tab) => tab.value === params.status)?.value ?? 'NEW') as ContactStatus

  const [messages, counts] = await Promise.all([
    db.contactMessage.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { handledBy: { select: { username: true } } },
    }),
    db.contactMessage.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const countFor = (value: ContactStatus) =>
    counts.find((row) => row.status === value)?._count._all ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Messages</h1>
        <p className="mt-1 text-body">
          Sent from the contact page. These are never shown publicly — this is the only place they
          can be read.
        </p>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/messages?status=${tab.value}`}
            aria-current={status === tab.value ? 'page' : undefined}
            className={buttonClass({
              variant: status === tab.value ? 'primary' : 'ghost',
              size: 'sm',
            })}
          >
            {tab.label} ({countFor(tab.value)})
          </Link>
        ))}
      </nav>

      {messages.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Nothing here"
              description={
                status === 'NEW'
                  ? 'New messages from the contact page will appear here.'
                  : 'No messages with this status yet.'
              }
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-4">
          {messages.map((message) => (
            <li key={message.id}>
              <Card>
                <CardHeader
                  title={message.subject}
                  description={`${message.name} · ${CATEGORY_LABELS.get(message.category) ?? message.category} · ${formatDate(message.createdAt, true)}`}
                  action={<Badge tone={TONES[message.status]}>{message.status.toLowerCase().replace('_', ' ')}</Badge>}
                />
                <CardBody className="space-y-4">
                  <p className="whitespace-pre-line text-body">{message.message}</p>

                  <dl className="grid gap-x-8 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted">Reply to</dt>
                      <dd className="break-words text-ink">
                        <a
                          href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}
                          className="underline underline-offset-4"
                        >
                          {message.email}
                        </a>
                      </dd>
                    </div>
                    {message.phone && (
                      <div>
                        <dt className="text-muted">Phone</dt>
                        <dd className="text-ink">{message.phone}</dd>
                      </div>
                    )}
                    {message.handledBy && (
                      <div>
                        <dt className="text-muted">Handled by</dt>
                        <dd className="text-ink">
                          {message.handledBy.username} · {formatDate(message.handledAt, true)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {message.handlerNote && (
                    <p className="rounded-field bg-surface-sunken px-4 py-3 text-sm text-body">
                      <span className="font-semibold text-ink">Note: </span>
                      {message.handlerNote}
                    </p>
                  )}

                  <ContactMessageActions id={message.id} status={message.status} />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
