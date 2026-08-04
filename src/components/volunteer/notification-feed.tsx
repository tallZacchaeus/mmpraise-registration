import {
  BadgeCheck,
  CalendarClock,
  FileCheck2,
  MailCheck,
  Save,
  UserPlus,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/primitives'
import { RevealStagger } from '@/components/ui/reveal'
import type { NotificationItem, NotificationKind } from '@/lib/applications/notifications'
import { cn, formatDate } from '@/lib/utils'

/**
 * Everything that has happened to this volunteer's application, newest first.
 *
 * Distinct from announcements, which are broadcast to many volunteers. These
 * are personal: only this account's own history appears here, so the two are
 * never mixed into one list where "you have been approved" would sit at the
 * same weight as "bring a water bottle".
 */

const ICONS: Record<NotificationKind, typeof UserPlus> = {
  account: UserPlus,
  email: MailCheck,
  draft: Save,
  status: FileCheck2,
  department: BadgeCheck,
  shifts: CalendarClock,
}

const TONES: Record<NotificationKind, string> = {
  account: 'bg-surface-sunken text-muted',
  email: 'bg-success-subtle text-success',
  draft: 'bg-surface-sunken text-muted',
  status: 'bg-primary-subtle text-primary-active',
  department: 'bg-success-subtle text-success',
  shifts: 'bg-info-subtle text-info',
}

export function NotificationFeed({ items }: { items: NotificationItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<FileCheck2 className="size-8" />}
        title="Nothing has happened yet"
        description="Every step of your application — saved, submitted, reviewed, approved — will appear here as it happens, so you never have to wonder where things stand."
      />
    )
  }

  return (
    <RevealStagger as="ol" selector="li" className="space-y-4" stagger={0.05} y={10}>
      {items.map((item) => {
        const Icon = ICONS[item.kind]

        return (
          <li key={item.id} className="flex gap-3 border-b border-line pb-4 last:border-0 last:pb-0">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                TONES[item.kind],
              )}
            >
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatDate(item.at, true)}</p>
              {item.body && <p className="mt-1.5 text-sm text-body">{item.body}</p>}
            </div>
          </li>
        )
      })}
    </RevealStagger>
  )
}
