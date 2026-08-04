import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { isExternal } from '@/config/site'

/**
 * A list of things a volunteer can do next.
 *
 * Used for both quick actions and the resources card, because they are the same
 * control with different content — one row, an icon, a label, a line of
 * explanation, and an affordance that says where it goes.
 *
 * A row with no `href` behaves in one of two ways:
 *
 *  - `placeholder: true` renders it greyed out and labelled "Coming soon". Used
 *    for things the organisation has told volunteers to expect but has not
 *    published yet — the handbook, for instance. A volunteer knowing it is
 *    coming is worth more than pretending the row does not exist.
 *  - otherwise the row is dropped entirely. Several destinations on this site
 *    sit behind launch flags and resolve to null until they exist; a dead row
 *    for each would be a list of things nobody can do.
 */

export type ActionItem = {
  id: string
  label: string
  description?: string
  icon: ReactNode
  /** Null while the destination does not exist yet. */
  href: string | null
  /** Show the row as "Coming soon" instead of hiding it. */
  placeholder?: boolean
}

export function ActionList({ items }: { items: ActionItem[] }) {
  const visible = items.filter((item) => Boolean(item.href) || item.placeholder)

  return (
    <ul className="-mx-2">
      {visible.map((item) => {
        if (!item.href) {
          return (
            <li key={item.id}>
              <div className="flex min-h-11 w-full items-start gap-3 rounded-field px-2 py-2.5">
                <span aria-hidden className="mt-0.5 shrink-0 text-muted">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-muted">{item.label}</span>
                  {item.description && (
                    <span className="mt-0.5 block text-xs text-muted">{item.description}</span>
                  )}
                </span>
                {/*
                  A span, not a disabled button: there is nothing to press. The
                  label is real text, so it is announced in reading order rather
                  than being a colour cue only.
                */}
                <span className="mt-0.5 shrink-0 rounded-pill bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
                  Coming soon
                </span>
              </div>
            </li>
          )
        }

        return renderLink(item as ActionItem & { href: string })
      })}
    </ul>
  )

  function renderLink(item: ActionItem & { href: string }) {
    const leavesSite = isExternal(item.href)
    const external = leavesSite || item.href.startsWith('mailto:')

    const inner = (
      <>
        <span aria-hidden className="mt-0.5 shrink-0 text-primary">
          {item.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{item.label}</span>
          {item.description && (
            <span className="mt-0.5 block text-xs text-muted">{item.description}</span>
          )}
        </span>
        {external ? (
          <ArrowUpRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
        ) : (
          <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
        )}
      </>
    )

    const className =
      'flex min-h-11 w-full items-start gap-3 rounded-field px-2 py-2.5 text-left transition-colors duration-[var(--duration-fast)] hover:bg-surface-sunken'

    return (
      <li key={item.id}>
        {external ? (
          <a
            href={item.href}
            {...(leavesSite ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={className}
          >
            {inner}
            {leavesSite && <span className="sr-only"> (opens in a new tab)</span>}
          </a>
        ) : (
          <Link href={item.href} className={className}>
            {inner}
          </Link>
        )}
      </li>
    )
  }
}
