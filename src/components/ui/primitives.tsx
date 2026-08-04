import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Presentational primitives.
 *
 * Deliberately hook-free so they render in both Server and Client Components.
 * Styling follows MMPRAISE-DESIGN-REFERENCE.md: pill buttons, warm neutrals,
 * soft-bordered cards, no gradients.
 */

// --- Button ---------------------------------------------------------------

/**
 * Button variants, ordered by visual weight.
 *
 * `primary` is the filled orange and carries the page's single most important
 * action. `outline` and `outlineOnDark` are its deliberate counterweight: the
 * same size and shape, so they read as a peer, but unfilled, so they never
 * compete for the first glance. That filled-versus-outlined distinction is what
 * communicates priority — colour alone would leave the hierarchy invisible to
 * anyone who cannot separate the two hues.
 */
type ButtonVariant =
  | 'primary'
  | 'outline'
  | 'outlineOnDark'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'link'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-pill font-display font-bold uppercase tracking-wide ' +
  // Transform and shadow join colour so the primary action can lift on hover.
  // Cancelled under prefers-reduced-motion by the base layer in globals.css.
  'transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-[var(--ease-out-soft)] ' +
  'disabled:cursor-not-allowed disabled:opacity-55 ' +
  // 44px minimum touch target on every size (WCAG 2.1 AA target size).
  'min-h-11'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  /**
   * The one action a page most wants taken. Lifts 1px and gains a shadow on
   * hover, and returns on press so the click is felt.
   */
  primary:
    'bg-primary text-white shadow-[var(--shadow-card)] ' +
    'hover:bg-primary-hover hover:shadow-[var(--shadow-raised)] ' +
    'active:bg-primary-active active:translate-y-0 active:shadow-[var(--shadow-card)] ' +
    'motion-safe:hover:-translate-y-px',

  /** Secondary on a light surface: unfilled, warming to orange on hover. */
  outline:
    'border border-line-strong bg-transparent text-ink ' +
    'hover:border-primary hover:bg-primary-subtle hover:text-primary-active',

  /** Secondary over a photograph or dark panel. */
  outlineOnDark:
    'border border-white/60 bg-transparent text-white ' +
    'hover:border-brand hover:bg-white/10 hover:text-brand',

  secondary: 'border border-ink bg-transparent text-ink hover:bg-ink hover:text-white',
  ghost: 'bg-transparent text-ink hover:bg-surface-sunken',
  danger: 'bg-danger text-white hover:brightness-90',
  link: 'min-h-0 rounded-none p-0 text-primary underline underline-offset-4 hover:text-primary-hover normal-case tracking-normal',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  isLoading = false,
  children,
  ...props
}: ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}) {
  return (
    <button
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], variant !== 'link' && BUTTON_SIZES[size], className)}
      aria-busy={isLoading || undefined}
      disabled={props.disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

/**
 * Button styling for elements that must remain links (navigation).
 * Using an anchor keeps middle-click, "open in new tab" and screen-reader
 * semantics correct — a <button> that navigates breaks all three.
 */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], variant !== 'link' && BUTTON_SIZES[size], className)
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        className ?? 'size-5',
      )}
    />
  )
}

// --- Card -----------------------------------------------------------------

export function Card({ className, children, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('rounded-card border border-line bg-surface shadow-[var(--shadow-card)]', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7', className)}>
      <div className="min-w-0">
        <h2 className="text-lg sm:text-xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted normal-case">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, children, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('px-5 py-5 sm:px-7 sm:py-6', className)} {...props}>
      {children}
    </div>
  )
}

// --- Alert ----------------------------------------------------------------

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const ALERT_TONES: Record<AlertTone, string> = {
  info: 'border-info/30 bg-info-subtle text-info',
  success: 'border-success/30 bg-success-subtle text-success',
  warning: 'border-warning/30 bg-warning-subtle text-warning',
  danger: 'border-danger/30 bg-danger-subtle text-danger',
}

/**
 * Status messaging. `role="alert"` is used for errors so screen readers announce
 * them immediately; softer tones use `role="status"` to avoid interrupting.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
  icon,
}: {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  className?: string
  icon?: ReactNode
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-card border p-4 text-sm', ALERT_TONES[tone], className)}
    >
      {icon && <span aria-hidden className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1', 'text-body')}>{children}</div>}
      </div>
    </div>
  )
}

// --- Badge ----------------------------------------------------------------

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    neutral: 'bg-surface-sunken text-body border-line',
    brand: 'bg-primary-subtle text-primary border-primary-border',
    success: 'bg-success-subtle text-success border-success/30',
    warning: 'bg-warning-subtle text-warning border-warning/30',
    danger: 'bg-danger-subtle text-danger border-danger/30',
    info: 'bg-info-subtle text-info border-info/30',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Small pill label above a section heading.
 *
 * Uses --color-primary-active on the tinted background, not --color-primary:
 * at this size (14px) the lighter pairing measures 4.25:1, just under the 4.5:1
 * AA threshold. Asserted in tests/unit/contrast.test.ts.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'inline-flex rounded-pill bg-primary-subtle px-4 py-1.5 font-display text-sm font-bold uppercase tracking-wide text-primary-active',
        className,
      )}
    >
      {children}
    </p>
  )
}

// --- Loading placeholders -------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-field bg-surface-sunken', className)} />
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-12 text-center">
      {icon && <div aria-hidden className="mb-3 text-muted">{icon}</div>}
      <h3 className="text-base">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// --- Brand ----------------------------------------------------------------

/**
 * MMPraise lockup: the official mark from mmpraise.org beside the wordmark.
 * The same artwork is used for the favicon and apple-touch icon (src/app/icon.png).
 */
export function Logo({
  className,
  inverted = false,
  subtitle = 'Volunteers',
}: {
  className?: string
  inverted?: boolean
  /** Set to null on the public site, where the wordmark stands alone. */
  subtitle?: string | null
}) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden
        width={38}
        height={40}
        className="h-10 w-auto shrink-0"
      />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-lg font-bold uppercase tracking-tight',
            inverted ? 'text-white' : 'text-ink',
          )}
        >
          MMPraise
        </span>
        {subtitle && (
          <span className={cn('text-[11px] uppercase tracking-wide', inverted ? 'text-white/70' : 'text-muted')}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )
}
