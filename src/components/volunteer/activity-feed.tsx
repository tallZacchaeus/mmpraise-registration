import { Megaphone, Milestone } from 'lucide-react'
import { EmptyState } from '@/components/ui/primitives'
import { RevealStagger } from '@/components/ui/reveal'
import { cn, formatDate } from '@/lib/utils'

/**
 * One feed for everything that has happened.
 *
 * Announcements and status changes used to sit in two separate cards at
 * opposite ends of the page, which meant that "your application was approved"
 * and "bring a water bottle" were never read in the order they arrived. They
 * are the same thing to a volunteer — news — so they are merged and sorted by
 * time, with the kind carried by an icon and a label rather than by position.
 */

export type FeedItem = {
  id: string
  kind: 'announcement' | 'status'
  title: string
  body: string | null
  at: Date
}

/** Merge and sort. Undated announcements are dropped, not guessed at. */
export function buildFeed({
  announcements,
  statusHistory,
}: {
  announcements: { id: string; title: string; body: string; publishedAt: Date | null }[]
  statusHistory: { id: string; label: string; reason: string | null; createdAt: Date }[]
}): FeedItem[] {
  const items: FeedItem[] = [
    ...announcements
      .filter((a): a is typeof a & { publishedAt: Date } => a.publishedAt !== null)
      .map((a) => ({
        id: `announcement-${a.id}`,
        kind: 'announcement' as const,
        title: a.title,
        body: a.body,
        at: a.publishedAt,
      })),
    ...statusHistory.map((s) => ({
      id: `status-${s.id}`,
      kind: 'status' as const,
      title: `Your application moved to “${s.label}”`,
      body: s.reason,
      at: s.createdAt,
    })),
  ]

  return items.sort((a, b) => b.at.getTime() - a.at.getTime())
}

export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="size-8" />}
        title="Nothing to report yet"
        description="Updates from the volunteer team, and every change to your application, will appear here as they happen."
      />
    )
  }

  return (
    <RevealStagger as="ol" selector="li" className="space-y-4" stagger={0.06} y={12}>
      {items.map((item) => {
        const isStatus = item.kind === 'status'
        const Icon = isStatus ? Milestone : Megaphone

        return (
          <li key={item.id} className="flex gap-3 border-b border-line pb-4 last:border-0 last:pb-0">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                isStatus ? 'bg-primary-subtle text-primary-active' : 'bg-info-subtle text-info',
              )}
            >
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                <span className="sr-only">{isStatus ? 'Application update' : 'Announcement'} · </span>
                {formatDate(item.at, true)}
              </p>
              {item.body && (
                <p className="mt-1.5 whitespace-pre-line text-sm text-body">{item.body}</p>
              )}
            </div>
          </li>
        )
      })}
    </RevealStagger>
  )
}
