'use client'

import { useCallback, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'
import { isExternal } from '@/config/site'

/**
 * Dismissible status bar, replacing the popup that opens automatically on the
 * current site. A popup that steals focus on every visit is both an
 * accessibility problem and the most-complained-about pattern on event sites;
 * a bar carries the same message without blocking the page.
 *
 * The dismissal is stored per message id, so publishing a new message shows the
 * bar again. localStorage is an external store, so it is read through
 * `useSyncExternalStore` rather than a setState-in-effect.
 *
 * The server snapshot renders the bar *visible*. Most visitors have not
 * dismissed it, and hiding it server-side then revealing it after hydration
 * shifted the header down on every first load — a cumulative-layout-shift cost
 * paid by everyone to spare a brief flash for the few who have dismissed it.
 */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readDismissed(id: string): boolean {
  try {
    return window.localStorage.getItem(`mmp-announcement-${id}`) === 'dismissed'
  } catch {
    // Private browsing can throw; showing the bar is the safe default.
    return false
  }
}

export function AnnouncementBar({
  id,
  message,
  href,
  linkLabel,
}: {
  id: string
  message: string
  href: string
  linkLabel: string
}) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(id),
    // Visible on the server: see the note above on layout shift.
    () => false,
  )

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(`mmp-announcement-${id}`, 'dismissed')
    } catch {
      // Nothing to do — the bar simply reappears on the next visit.
    }
    listeners.forEach((listener) => listener())
  }, [id])

  if (dismissed) return null

  const external = isExternal(href)

  return (
    <div role="region" aria-label="Announcement" className="bg-ink text-white">
      <div className="container-content flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2.5 text-sm">
        <p className="text-center text-white/90">{message}</p>

        <Link
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="inline-flex items-center gap-1.5 font-semibold text-white underline underline-offset-4"
        >
          {linkLabel}
          <ArrowRight aria-hidden className="size-3.5" />
          {external && <span className="sr-only"> (opens in a new tab)</span>}
        </Link>

        <button
          type="button"
          onClick={dismiss}
          className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-field text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss announcement"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  )
}
