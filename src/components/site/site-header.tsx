'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Menu, X } from 'lucide-react'
import { buttonClass, Logo } from '@/components/ui/primitives'
import { isExternal } from '@/config/site'
import { navActions, primaryNav, type NavItem } from '@/content/navigation'
import { cn } from '@/lib/utils'

/**
 * Public site header.
 *
 * The mobile panel is a modal dialog: it traps focus, closes on Escape and on
 * outside click, locks background scroll, restores focus to the trigger, and
 * marks the rest of the page inert for assistive technology. Desktop submenus
 * open on hover *and* on click/keyboard, so they are not mouse-only.
 */
export function SiteHeader({ isSignedIn = false }: { isSignedIn?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  // Escape closes whichever layer is open, innermost first.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (mobileOpen) setMobileOpen(false)
      else if (openMenu) setOpenMenu(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, openMenu])

  // Lock scroll, trap focus and restore it when the mobile panel closes.
  useEffect(() => {
    if (!mobileOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const trigger = triggerRef.current
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null)

    focusables()[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [mobileOpen])

  // Close desktop submenus when focus or the pointer leaves the header.
  useEffect(() => {
    if (!openMenu) return
    function onPointerDown(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest('[data-site-nav]')) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [openMenu])

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="container-content flex items-center justify-between gap-4 py-3">
        <Link href="/" aria-label="MMPraise home" className="shrink-0">
          <Logo subtitle={null} />
        </Link>

        {/* ---------------------------------------------------------- Desktop */}
        <nav aria-label="Main" data-site-nav className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {primaryNav.map((item) => (
              <li key={item.label} className="relative">
                {item.children ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={openMenu === item.label}
                      aria-controls={`${panelId}-${item.label}`}
                      onClick={() => setOpenMenu((current) => (current === item.label ? null : item.label))}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-field px-3 py-2 text-sm font-semibold text-body hover:bg-surface-sunken"
                    >
                      {item.label}
                      <ChevronDown
                        aria-hidden
                        className={cn('size-4 transition-transform', openMenu === item.label && 'rotate-180')}
                      />
                    </button>

                    {openMenu === item.label && (
                      <ul
                        id={`${panelId}-${item.label}`}
                        className="absolute left-0 top-full z-50 mt-1 w-64 rounded-card border border-line bg-surface p-2 shadow-[var(--shadow-raised)]"
                      >
                        {item.children.map((child) => (
                          <li key={child.label}>
                            <NavLeaf item={child} onNavigate={() => setOpenMenu(null)} showDescription />
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <NavLeaf item={item} onNavigate={() => setOpenMenu(null)} />
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {navActions.map((action) => (
            <ActionLink key={action.label} {...action} />
          ))}
          {isSignedIn && (
            <Link href="/dashboard" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
              Dashboard
            </Link>
          )}
        </div>

        {/* ----------------------------------------------------------- Mobile */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls={panelId}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-field px-3 text-sm font-semibold text-ink hover:bg-surface-sunken lg:hidden"
        >
          <Menu aria-hidden className="size-5" />
          Menu
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-night/60"
          />

          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto bg-surface shadow-[var(--shadow-overlay)]"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <Logo subtitle={null} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-field px-3 text-sm font-semibold text-ink hover:bg-surface-sunken"
              >
                <X aria-hidden className="size-5" />
                Close
              </button>
            </div>

            <nav aria-label="Mobile" className="flex-1 px-4 py-4">
              <ul className="space-y-1">
                {primaryNav.map((item) => (
                  <li key={item.label}>
                    {item.children ? (
                      <>
                        <p className="px-3 pb-1 pt-4 font-display text-xs font-bold uppercase tracking-wide text-muted">
                          {item.label}
                        </p>
                        <ul className="space-y-1">
                          {item.children.map((child) => (
                            <li key={child.label}>
                              <NavLeaf item={child} onNavigate={() => setMobileOpen(false)} mobile showDescription />
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <NavLeaf item={item} onNavigate={() => setMobileOpen(false)} mobile />
                    )}
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-2 border-t border-line px-4 py-4">
              {navActions.map((action) => (
                <ActionLink key={action.label} {...action} className="w-full" />
              ))}
              {isSignedIn && (
                <Link href="/dashboard" className={buttonClass({ variant: 'ghost', className: 'w-full' })}>
                  Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

/** A single navigation destination, or inert text when it has none yet. */
function NavLeaf({
  item,
  onNavigate,
  mobile = false,
  showDescription = false,
}: {
  item: NavItem
  onNavigate?: () => void
  mobile?: boolean
  /** Descriptions are useful inside a dropdown, but make the top bar too tall. */
  showDescription?: boolean
}) {
  const base = cn(
    'flex min-h-11 flex-col justify-center rounded-field px-3 py-2 text-sm font-semibold hover:bg-surface-sunken',
    mobile && 'text-base',
  )

  // Items with no destination yet are announced as such instead of linking to "#".
  if (!item.href || item.comingSoon) {
    return (
      <span className={cn(base, 'cursor-default text-muted hover:bg-transparent')}>
        {item.label}
        <span className="text-xs font-normal text-muted">Coming soon</span>
      </span>
    )
  }

  const external = isExternal(item.href)

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(base, 'text-body')}
    >
      <span>
        {item.label}
        {external && <span className="sr-only"> (opens in a new tab)</span>}
      </span>
      {showDescription && item.description && (
        <span className="text-xs font-normal text-muted">{item.description}</span>
      )}
    </Link>
  )
}

function ActionLink({
  label,
  href,
  variant,
  className,
}: {
  label: string
  href: string
  variant: 'primary' | 'secondary'
  className?: string
}) {
  const external = isExternal(href)
  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={buttonClass({ variant, size: 'sm', className })}
    >
      {label}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </Link>
  )
}
