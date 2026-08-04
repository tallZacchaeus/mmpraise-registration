'use client'

import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ChevronDown, Menu } from 'lucide-react'
import { buttonClass, Logo } from '@/components/ui/primitives'
import {
  Sheet,
  SheetClose,
  SheetCloseButton,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { isExternal } from '@/config/site'
import { navActions, primaryNav, type NavItem } from '@/content/navigation'
import { cn } from '@/lib/utils'

/**
 * Public site header.
 *
 * Two behaviours worth knowing about:
 *
 *  - Over a dark hero the bar starts transparent and turns solid once the page
 *    scrolls, so the photograph is not cropped by a white band on arrival.
 *    Pages without a dark hero leave `overlay` false and get the solid bar from
 *    the start.
 *  - The mobile panel is a Radix-backed Sheet. Focus trapping, scroll locking,
 *    Escape handling, focus restoration and hiding the rest of the page from
 *    assistive technology all come from Radix rather than being reimplemented
 *    here — this replaced about sixty lines of bespoke code.
 *
 * Desktop submenus open on click and keyboard, so they are never mouse-only.
 */

/**
 * Tracks whether the page has scrolled past a threshold.
 *
 * `useSyncExternalStore` rather than an effect: the React Compiler forbids
 * setting state from an effect for this, and it gives a defined server
 * snapshot, so the first paint matches the server and the bar does not flash.
 */
function subscribeToScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true })
  return () => window.removeEventListener('scroll', onChange)
}

function useHasScrolled(threshold = 24) {
  return useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > threshold,
    () => false,
  )
}

export function SiteHeader({
  isSignedIn = false,
  overlay = false,
}: {
  isSignedIn?: boolean
  /** True when the header sits over a dark hero on this page. */
  overlay?: boolean
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const panelId = useId()
  const scrolled = useHasScrolled()

  // Transparent only while overlaying a hero and still at the top of the page.
  const transparent = overlay && !scrolled

  // Escape closes an open submenu. The Sheet handles its own.
  useEffect(() => {
    if (!openMenu) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [openMenu])

  // Close desktop submenus when the pointer goes down outside the header.
  useEffect(() => {
    if (!openMenu) return
    function onPointerDown(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest('[data-site-nav]')) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [openMenu])

  return (
    <header
      data-transparent={transparent || undefined}
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300 motion-reduce:transition-none',
        // No border while transparent: a 1px transparent border still occupies
        // height, which leaves a hairline of page background above the hero.
        transparent
          ? 'bg-transparent'
          : 'border-b border-line bg-surface/95 shadow-[var(--shadow-card)] backdrop-blur',
      )}
    >
      <div
        className={cn(
          'container-content flex items-center justify-between gap-4 transition-[height] duration-300 motion-reduce:transition-none',
          // A fixed height rather than padding: the hero offsets itself by
          // exactly --spacing-header-overlay, and that only works if the bar is
          // reliably that tall. The bar tightens on scroll, which reads as the
          // page settling.
          transparent ? 'h-header-overlay' : 'h-16',
        )}
      >
        <Link href="/" aria-label="MMPraise home" className="shrink-0">
          <Logo subtitle={null} inverted={transparent} />
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
                      onClick={() =>
                        setOpenMenu((current) => (current === item.label ? null : item.label))
                      }
                      className={cn(
                        'inline-flex min-h-11 items-center gap-1.5 rounded-field px-3 py-2 text-sm font-semibold',
                        transparent
                          ? 'text-white hover:bg-white/10'
                          : 'text-body hover:bg-surface-sunken',
                      )}
                    >
                      {item.label}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          'size-4 transition-transform motion-reduce:transition-none',
                          openMenu === item.label && 'rotate-180',
                        )}
                      />
                    </button>

                    {openMenu === item.label && (
                      <ul
                        id={`${panelId}-${item.label}`}
                        className="absolute left-0 top-full z-50 mt-1 w-64 rounded-card border border-line bg-surface p-2 shadow-[var(--shadow-raised)]"
                      >
                        {item.children.map((child) => (
                          <li key={child.label}>
                            <NavLeaf
                              item={child}
                              onNavigate={() => setOpenMenu(null)}
                              showDescription
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <NavLeaf item={item} onNavigate={() => setOpenMenu(null)} onDark={transparent} />
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {navActions.map((action) => (
            <ActionLink key={action.label} {...action} onDark={transparent} />
          ))}
          {isSignedIn && (
            <Link
              href="/dashboard"
              className={buttonClass({
                variant: 'ghost',
                size: 'sm',
                className: transparent ? 'text-white hover:bg-white/10' : undefined,
              })}
            >
              Dashboard
            </Link>
          )}
        </div>

        {/* ----------------------------------------------------------- Mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className={cn(
              'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-field px-3 text-sm font-semibold lg:hidden',
              transparent ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-surface-sunken',
            )}
          >
            <Menu aria-hidden className="size-5" />
            Menu
          </SheetTrigger>

          <SheetContent side="right" className="lg:hidden" aria-describedby={undefined}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              {/* The sheet needs an accessible name; the wordmark is the title. */}
              <SheetTitle asChild>
                <span>
                  <Logo subtitle={null} />
                  <span className="sr-only">Site menu</span>
                </span>
              </SheetTitle>
              <SheetCloseButton />
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
                              <SheetClose asChild>
                                <NavLeafLink item={child} mobile showDescription />
                              </SheetClose>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <SheetClose asChild>
                        <NavLeafLink item={item} mobile />
                      </SheetClose>
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
                <Link
                  href="/dashboard"
                  className={buttonClass({ variant: 'ghost', className: 'w-full' })}
                >
                  Dashboard
                </Link>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

const leafClass = (mobile: boolean) =>
  cn(
    'flex min-h-11 flex-col justify-center rounded-field px-3 py-2 text-sm font-semibold',
    mobile && 'text-base',
  )

/**
 * A leaf rendered inside the Sheet.
 *
 * Split out from `NavLeaf` because `SheetClose asChild` needs to forward its
 * props onto exactly one child element, and it must be able to do so whether
 * the item is a link or inert text.
 */
function NavLeafLink({
  item,
  mobile = false,
  showDescription = false,
  ...props
}: {
  item: NavItem
  mobile?: boolean
  showDescription?: boolean
}) {
  if (!item.href || item.comingSoon) {
    return (
      <span className={cn(leafClass(mobile), 'cursor-default text-muted')} {...props}>
        {item.label}
        <span className="text-xs font-normal text-muted">Coming soon</span>
      </span>
    )
  }

  const external = isExternal(item.href)
  return (
    <Link
      href={item.href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(leafClass(mobile), 'text-body hover:bg-surface-sunken')}
      {...props}
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

/** A single navigation destination, or inert text when it has none yet. */
function NavLeaf({
  item,
  onNavigate,
  showDescription = false,
  onDark = false,
}: {
  item: NavItem
  onNavigate?: () => void
  /** Descriptions are useful inside a dropdown, but make the top bar too tall. */
  showDescription?: boolean
  onDark?: boolean
}) {
  const base = leafClass(false)

  // Items with no destination yet are announced as such instead of linking to "#".
  if (!item.href || item.comingSoon) {
    return (
      <span className={cn(base, 'cursor-default', onDark ? 'text-white/80' : 'text-muted')}>
        {item.label}
        <span className={cn('text-xs font-normal', onDark ? 'text-white/80' : 'text-muted')}>
          Coming soon
        </span>
      </span>
    )
  }

  const external = isExternal(item.href)

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(
        base,
        onDark ? 'text-white hover:bg-white/10' : 'text-body hover:bg-surface-sunken',
      )}
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
  onDark = false,
}: {
  label: string
  href: string
  variant: 'primary' | 'secondary'
  className?: string
  onDark?: boolean
}) {
  const external = isExternal(href)
  return (
    <Link
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={buttonClass({
        variant,
        size: 'sm',
        className: cn(
          // A pale secondary button vanishes on a transparent bar, so over the
          // hero it becomes a white outline instead.
          onDark &&
            variant === 'secondary' &&
            'bg-transparent text-white ring-1 ring-inset ring-white/60 hover:bg-white/10',
          className,
        ),
      })}
    >
      {label}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </Link>
  )
}
