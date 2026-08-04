import type { Metadata } from 'next'
import Link from 'next/link'
import { Inbox, Lock, Mail, Phone, Reply, UserRound } from 'lucide-react'
import { ContactMessageActions } from '@/components/admin/contact-message-actions'
import { BulkResolveTestMessages } from '@/components/admin/messages/bulk-resolve-test-messages'
import { MessageControls } from '@/components/admin/messages/message-controls'
import { MessageNoteForm } from '@/components/admin/messages/message-note-form'
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
import type { ContactPriority, ContactStatus } from '@/generated/prisma/enums'
import type { Prisma } from '@/generated/prisma/client'

export const metadata: Metadata = { title: 'Contact messages' }

const TABS: { value: ContactStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
]

const STATUS_TONES: Record<ContactStatus, 'warning' | 'neutral' | 'success'> = {
  NEW: 'warning',
  IN_PROGRESS: 'neutral',
  RESOLVED: 'success',
}

const PRIORITY_TONES: Record<ContactPriority, 'neutral' | 'info' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
}

const PER_PAGE = 20

/**
 * The contact inbox, as a helpdesk.
 *
 * Split view: the list on the left is for triage — unread weight, priority,
 * age, who has it — and the pane on the right is one conversation, with the
 * sender's profile, their volunteer record if their address matches one, the
 * duplicate group, and the note timeline. Opening a message marks it read;
 * replying goes through the reader's own mail client until the organisation
 * decides whether the platform should send mail in its name.
 *
 * Test data is hidden by default, for the same reason as testimonies: mixed in,
 * 103 fixtures made "New: 103" mean nothing.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string
    status?: string
    q?: string
    category?: string
    source?: string
    page?: string
  }>
}) {
  const user = await requirePermission('contact:manage')
  const params = await searchParams

  const status = (TABS.find((tab) => tab.value === params.status)?.value ?? 'NEW') as ContactStatus
  const source = params.source === 'test' ? 'test' : params.source === 'all' ? 'all' : 'real'
  const q = params.q?.trim() ?? ''
  const category = contactCategories.find((c) => c.value === params.category)?.value
  const page = Math.max(1, Number(params.page ?? 1) || 1)

  const where: Prisma.ContactMessageWhereInput = {
    status,
    ...(source === 'real' ? { isTestData: false } : source === 'test' ? { isTestData: true } : {}),
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { message: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [items, total, counts, openTestData] = await Promise.all([
    db.contactMessage.findMany({
      where,
      // Urgent first inside each tab; then newest.
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        subject: true,
        name: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        firstReadAt: true,
        isSpam: true,
        isTestData: true,
        assignedTo: { select: { username: true } },
        _count: { select: { notes: true } },
      },
    }),
    db.contactMessage.count({ where }),
    db.contactMessage.groupBy({
      by: ['status'],
      where:
        source === 'real' ? { isTestData: false } : source === 'test' ? { isTestData: true } : {},
      _count: { _all: true },
    }),
    db.contactMessage.count({ where: { isTestData: true, status: { not: 'RESOLVED' } } }),
  ])

  const countFor = (value: ContactStatus) =>
    counts.find((row) => row.status === value)?._count._all ?? 0
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  const now = new Date().getTime()

  // ------------------------------------------------------------ detail pane
  const selected = params.id
    ? await db.contactMessage.findUnique({
        where: { id: params.id },
        include: {
          assignedTo: { select: { id: true, username: true } },
          notes: {
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { username: true } } },
          },
        },
      })
    : null

  let related: {
    mmpCode: string | null
    firstName: string | null
    applicationStatus: string | null
  } | null = null
  let duplicates: { id: string; createdAt: Date; status: ContactStatus }[] = []

  if (selected) {
    // Opening a message is what "read" means.
    if (!selected.firstReadAt) {
      await db.contactMessage.update({
        where: { id: selected.id },
        data: { firstReadAt: new Date() },
      })
    }

    const [relatedUser, sameHash] = await Promise.all([
      db.user.findUnique({
        where: { email: selected.email.toLowerCase() },
        select: {
          mmpCode: true,
          profile: { select: { firstName: true } },
          applications: { select: { status: true } },
        },
      }),
      selected.messageHash
        ? db.contactMessage.findMany({
            where: { messageHash: selected.messageHash, id: { not: selected.id } },
            select: { id: true, createdAt: true, status: true },
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
    ])

    related = relatedUser
      ? {
          mmpCode: relatedUser.mmpCode,
          firstName: relatedUser.profile?.firstName ?? null,
          applicationStatus: relatedUser.applications[0]?.status ?? null,
        }
      : null
    duplicates = sameHash
  }

  const link = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = {
      status,
      q,
      source,
      category,
      id: params.id,
      ...overrides,
    }
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (!value) continue
      if (key === 'source' && value === 'real') continue
      if (key === 'status' && value === 'NEW') continue
      next.set(key, value)
    }
    const qs = next.toString()
    return `/admin/messages${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Messages</h1>
          <p className="mt-1 text-body">
            The public contact inbox. Replies open in your own mail client.
          </p>
        </div>
        {openTestData > 0 && <BulkResolveTestMessages count={openTestData} />}
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={link({ status: tab.value, page: undefined, id: undefined })}
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

      <form action="/admin/messages" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="status" value={status} />
        <div className="min-w-56 flex-1">
          <label
            htmlFor="msg-q"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Search
          </label>
          <input
            id="msg-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Subject, name, email or words from the message"
            className="min-h-11 w-full rounded-field border border-line-strong bg-surface px-4 py-2 text-sm text-body placeholder:text-muted/70 hover:border-muted focus:border-primary"
          />
        </div>
        <div>
          <label
            htmlFor="msg-category"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Category
          </label>
          <select
            id="msg-category"
            name="category"
            defaultValue={category ?? ''}
            className="min-h-11 rounded-field border border-line-strong bg-surface px-3 py-2 text-sm text-body"
          >
            <option value="">All categories</option>
            {contactCategories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="msg-source"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Source
          </label>
          <select
            id="msg-source"
            name="source"
            defaultValue={source}
            className="min-h-11 rounded-field border border-line-strong bg-surface px-3 py-2 text-sm text-body"
          >
            <option value="real">Real messages</option>
            <option value="test">Test data</option>
            <option value="all">Everything</option>
          </select>
        </div>
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          Apply
        </button>
      </form>

      {/* ---------------------------------------------------- split layout */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* -------------------------------------------------------- list */}
        <Card className="overflow-hidden">
          {items.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={<Inbox className="size-8" />}
                title="Nothing here"
                description={
                  q
                    ? 'Nothing matches that search.'
                    : status === 'NEW'
                      ? 'New messages from the contact page will appear here.'
                      : 'No messages with this status.'
                }
              />
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const unread = !item.firstReadAt
                const days = Math.floor((now - item.createdAt.getTime()) / 86_400_000)
                const isOpen = item.id === params.id
                return (
                  <li key={item.id}>
                    <Link
                      href={link({ id: item.id })}
                      aria-current={isOpen ? 'true' : undefined}
                      className={`block px-4 py-3 hover:bg-surface-sunken ${isOpen ? 'bg-primary-subtle' : ''}`}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={`min-w-0 truncate text-sm ${unread ? 'font-bold text-ink' : 'font-medium text-body'}`}
                        >
                          {unread && <span className="sr-only">Unread: </span>}
                          {item.subject}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">
                          {formatDate(item.createdAt)}
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs text-muted">{item.name}</span>
                        {item.priority !== 'NORMAL' && (
                          <Badge tone={PRIORITY_TONES[item.priority]}>
                            {item.priority.toLowerCase()}
                          </Badge>
                        )}
                        {item.isSpam && <Badge tone="danger">Spam</Badge>}
                        {item.isTestData && <Badge tone="neutral">Test</Badge>}
                        {item.assignedTo && <Badge tone="info">{item.assignedTo.username}</Badge>}
                        {status !== 'RESOLVED' && days >= 7 && (
                          <span className="text-xs font-semibold text-warning">{days} days old</span>
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {pages > 1 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between gap-3 border-t border-line px-4 py-3"
            >
              <p className="text-xs text-muted">
                Page {page} of {pages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={link({ page: String(page - 1) })}
                    className={buttonClass({ variant: 'ghost', size: 'sm' })}
                  >
                    Previous
                  </Link>
                )}
                {page < pages && (
                  <Link
                    href={link({ page: String(page + 1) })}
                    className={buttonClass({ variant: 'ghost', size: 'sm' })}
                  >
                    Next
                  </Link>
                )}
              </div>
            </nav>
          )}
        </Card>

        {/* ------------------------------------------------------ detail */}
        {!selected ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<Mail className="size-8" />}
                title="Choose a message"
                description="Everything about it — the sender, their volunteer record, duplicates and notes — appears here."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title={selected.subject}
                description={`${contactCategories.find((c) => c.value === selected.category)?.label ?? selected.category} · ${formatDate(selected.createdAt, true)}`}
                action={
                  <Badge tone={STATUS_TONES[selected.status]}>
                    {selected.status.toLowerCase().replace('_', ' ')}
                  </Badge>
                }
              />
              <CardBody className="space-y-5">
                <p className="whitespace-pre-line text-body">{selected.message}</p>

                <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                  <a
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}
                    className={buttonClass({ size: 'sm' })}
                  >
                    <Reply aria-hidden className="size-4" />
                    Reply by email
                  </a>
                  <MessageControls
                    id={selected.id}
                    priority={selected.priority}
                    isSpam={selected.isSpam}
                    isTestData={selected.isTestData}
                    assignedToMe={selected.assignedTo?.id === user.id}
                    assignedToName={selected.assignedTo?.username ?? null}
                  />
                </div>

                <ContactMessageActions id={selected.id} status={selected.status} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Sender" />
              <CardBody className="space-y-3 text-sm">
                <p className="flex items-center gap-2 text-body">
                  <UserRound aria-hidden className="size-4 shrink-0 text-muted" />
                  {selected.name}
                </p>
                <p className="flex items-center gap-2 text-body">
                  <Mail aria-hidden className="size-4 shrink-0 text-muted" />
                  <span className="break-all">{selected.email}</span>
                </p>
                {selected.phone && (
                  <p className="flex items-center gap-2 text-body">
                    <Phone aria-hidden className="size-4 shrink-0 text-muted" />
                    {selected.phone}
                  </p>
                )}

                {related ? (
                  <p className="rounded-field bg-success-subtle px-3 py-2 text-success">
                    Registered volunteer
                    {related.firstName ? ` — ${related.firstName}` : ''}
                    {related.mmpCode ? `, ${related.mmpCode}` : ''}
                    {related.applicationStatus
                      ? ` · application ${related.applicationStatus.toLowerCase().replace('_', ' ')}`
                      : ''}
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-muted">
                    <Lock aria-hidden className="size-4 shrink-0" />
                    No volunteer account matches this address.
                  </p>
                )}
              </CardBody>
            </Card>

            {duplicates.length > 0 && (
              <Card>
                <CardHeader
                  title={`Same message, sent ${duplicates.length === 1 ? 'once more' : `${duplicates.length} more times`}`}
                  description="Identical words after normalising spacing — usually the form re-submitted on a slow connection. Resolve one, and the rest are the same conversation."
                />
                <CardBody className="py-3">
                  <ul className="divide-y divide-line">
                    {duplicates.map((duplicate) => (
                      <li key={duplicate.id}>
                        <Link
                          href={link({ id: duplicate.id })}
                          className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:bg-surface-sunken"
                        >
                          <span className="text-body">{formatDate(duplicate.createdAt, true)}</span>
                          <Badge tone={STATUS_TONES[duplicate.status]}>
                            {duplicate.status.toLowerCase().replace('_', ' ')}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader
                title="Team notes"
                description="Internal only — never sent to the person who wrote in."
              />
              <CardBody className="space-y-4">
                <MessageNoteForm id={selected.id} />
                {selected.notes.length === 0 ? (
                  <p className="text-sm text-muted">No notes yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {selected.notes.map((note) => (
                      <li key={note.id} className="rounded-field bg-surface-sunken px-4 py-3">
                        <p className="text-sm text-body">{note.body}</p>
                        <p className="mt-1 text-xs text-muted">
                          {note.author?.username ?? 'Unknown'} · {formatDate(note.createdAt, true)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
