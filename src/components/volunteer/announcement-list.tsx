import { Megaphone } from 'lucide-react'
import { EmptyState } from '@/components/ui/primitives'
import { RevealStagger } from '@/components/ui/reveal'
import { formatDate } from '@/lib/utils'

/**
 * Announcements from the volunteer team.
 *
 * Broadcast messages, kept apart from the personal notification feed. An
 * announcement is written once and read by hundreds of volunteers; a
 * notification is about this account alone. Merging them would put "the rota is
 * published" and "you were approved" on the same footing, and the one that
 * matters would be the one that scrolled past.
 */
export function AnnouncementList({
  announcements,
}: {
  announcements: { id: string; title: string; body: string; publishedAt: Date | null }[]
}) {
  const published = announcements.filter(
    (a): a is typeof a & { publishedAt: Date } => a.publishedAt !== null,
  )

  if (published.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="size-8" />}
        title="No announcements yet"
        description="Briefings, rota news and anything else the volunteer team needs every volunteer to know will be posted here — and emailed to you if it is urgent."
      />
    )
  }

  return (
    <RevealStagger as="ul" selector="li" className="space-y-4" stagger={0.06} y={12}>
      {published.map((announcement) => (
        <li key={announcement.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
          <p className="font-display font-bold uppercase text-ink">{announcement.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            <span className="sr-only">Published </span>
            {formatDate(announcement.publishedAt)}
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm text-body">{announcement.body}</p>
        </li>
      ))}
    </RevealStagger>
  )
}
