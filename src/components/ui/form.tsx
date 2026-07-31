'use client'

import { useId, useMemo, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PASSWORD_RULES, passwordStrength } from '@/lib/validation/common'

/**
 * Accessible form controls.
 *
 * Every control is label-associated, describes its own help and error text via
 * aria-describedby, exposes aria-invalid, and never signals state with colour
 * alone (errors always carry an icon and text).
 */

// --- Field wrapper --------------------------------------------------------

export type FieldProps = {
  label: string
  htmlFor?: string
  help?: ReactNode
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
  /** Renders the label as a <legend> for grouped controls. */
  asFieldset?: boolean
}

export function Field({ label, htmlFor, help, error, required, children, className, asFieldset }: FieldProps) {
  const generatedId = useId()
  const helpId = help ? `${htmlFor ?? generatedId}-help` : undefined
  const errorId = error ? `${htmlFor ?? generatedId}-error` : undefined

  const labelContent = (
    <>
      {label}
      {required ? (
        <span className="ml-1 text-primary" aria-hidden>
          *
        </span>
      ) : (
        <span className="ml-2 text-xs font-normal normal-case text-muted">(optional)</span>
      )}
      {required && <span className="sr-only"> (required)</span>}
    </>
  )

  const body = (
    <>
      {help && (
        <p id={helpId} className="mt-1 text-sm text-muted">
          {help}
        </p>
      )}
      <div className="mt-2">{children}</div>
      {error && (
        <p id={errorId} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </>
  )

  if (asFieldset) {
    return (
      <fieldset className={cn('min-w-0', className)} aria-describedby={cn(helpId, errorId) || undefined}>
        <legend className="font-display text-base font-bold uppercase tracking-wide text-ink">{labelContent}</legend>
        {body}
      </fieldset>
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="font-display text-base font-bold uppercase tracking-wide text-ink">
        {labelContent}
      </label>
      {body}
    </div>
  )
}

/** Ids a control should reference; keeps aria-describedby wiring consistent. */
export function describedBy(id: string, opts: { help?: unknown; error?: unknown }) {
  return cn(Boolean(opts.help) && `${id}-help`, Boolean(opts.error) && `${id}-error`) || undefined
}

// --- Inputs ---------------------------------------------------------------

const CONTROL =
  'w-full rounded-field border bg-surface px-4 py-3 text-base text-body placeholder:text-muted/70 ' +
  'transition-colors min-h-11 disabled:cursor-not-allowed disabled:bg-surface-sunken'

const CONTROL_STATE = (invalid?: boolean) =>
  invalid
    ? 'border-danger focus:border-danger'
    : 'border-line-strong hover:border-muted focus:border-primary'

export function TextInput({
  invalid,
  className,
  ...props
}: ComponentPropsWithoutRef<'input'> & { invalid?: boolean }) {
  return (
    <input
      className={cn(CONTROL, CONTROL_STATE(invalid), className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

export function TextArea({
  invalid,
  className,
  maxLength,
  value,
  ...props
}: ComponentPropsWithoutRef<'textarea'> & { invalid?: boolean }) {
  const length = typeof value === 'string' ? value.length : 0
  return (
    <div>
      <textarea
        className={cn(CONTROL, CONTROL_STATE(invalid), 'min-h-28 resize-y', className)}
        aria-invalid={invalid || undefined}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      {maxLength ? (
        <p className="mt-1 text-right text-xs text-muted" aria-live="polite">
          {length}/{maxLength} characters
        </p>
      ) : null}
    </div>
  )
}

export function SelectInput({
  invalid,
  className,
  placeholder,
  children,
  ...props
}: ComponentPropsWithoutRef<'select'> & { invalid?: boolean; placeholder?: string }) {
  return (
    <select
      className={cn(CONTROL, CONTROL_STATE(invalid), 'appearance-none bg-[length:auto] pr-10', className)}
      aria-invalid={invalid || undefined}
      style={{
        // Chevron drawn inline so no network request or icon font is needed.
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a5a5a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.85rem center',
      }}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  )
}

// --- Choice groups --------------------------------------------------------

export type Choice = { value: string; label: string; description?: string; requiresText?: boolean }

export function RadioGroup({
  name,
  options,
  value,
  onChange,
  invalid,
  columns = 1,
}: {
  name: string
  options: Choice[]
  value?: string | null
  onChange: (value: string) => void
  invalid?: boolean
  columns?: 1 | 2 | 3
}) {
  return (
    <div
      className={cn(
        'grid gap-2',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {options.map((option) => {
        const checked = value === option.value
        return (
          <label
            key={option.value}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-3 rounded-field border p-3 transition-colors',
              checked ? 'border-primary bg-primary-subtle' : 'border-line-strong hover:border-muted',
              invalid && !checked && 'border-danger/60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="min-w-0">
              <span className="block font-medium text-ink">{option.label}</span>
              {option.description && <span className="block text-sm text-muted">{option.description}</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function CheckboxGroup({
  name,
  options,
  values,
  onChange,
  onToggle,
  invalid,
  columns = 2,
}: {
  name: string
  options: Choice[]
  values: string[]
  /** Receives the whole next array. Convenient, but see onToggle. */
  onChange?: (values: string[]) => void
  /**
   * Receives only the option that changed. Prefer this: the parent can merge
   * with a functional state update, so two toggles in the same React batch
   * cannot overwrite each other (the whole-array form recomputes from a value
   * captured at render time).
   */
  onToggle?: (value: string, checked: boolean) => void
  invalid?: boolean
  columns?: 1 | 2 | 3
}) {
  const toggle = (value: string) => {
    const checked = !values.includes(value)
    if (onToggle) {
      onToggle(value, checked)
      return
    }
    onChange?.(checked ? [...values, value] : values.filter((v) => v !== value))
  }

  return (
    <div
      className={cn(
        'grid gap-2',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {options.map((option) => {
        const checked = values.includes(option.value)
        return (
          <label
            key={option.value}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-3 rounded-field border p-3 transition-colors',
              checked ? 'border-primary bg-primary-subtle' : 'border-line-strong hover:border-muted',
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => toggle(option.value)}
              aria-invalid={invalid || undefined}
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="min-w-0">
              <span className="block font-medium text-ink">{option.label}</span>
              {option.description && <span className="block text-sm text-muted">{option.description}</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  invalid,
  name,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  invalid?: boolean
  name?: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-field border p-3 transition-colors',
        checked ? 'border-primary bg-primary-subtle' : 'border-line-strong hover:border-muted',
        invalid && 'border-danger',
      )}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]"
      />
      <span className="min-w-0 text-sm">
        <span className="block text-body">{label}</span>
        {description && <span className="mt-0.5 block text-muted">{description}</span>}
      </span>
    </label>
  )
}

// --- Rating ---------------------------------------------------------------

export function RatingInput({
  name,
  min,
  max,
  value,
  onChange,
  labels,
  invalid,
}: {
  name: string
  min: number
  max: number
  value: number | null
  onChange: (value: number) => void
  labels?: Record<number, string>
  invalid?: boolean
}) {
  const scale = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max],
  )

  return (
    <div role="radiogroup" aria-invalid={invalid || undefined} className="flex flex-wrap gap-2">
      {scale.map((n) => {
        const selected = value === n
        return (
          <label
            key={n}
            className={cn(
              'flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center rounded-field border px-3 py-2 text-center transition-colors',
              selected ? 'border-primary bg-primary text-white' : 'border-line-strong hover:border-muted',
            )}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={selected}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <span className="font-display text-lg font-bold">{n}</span>
            {labels?.[n] && (
              <span className={cn('text-[11px]', selected ? 'text-white/85' : 'text-muted')}>{labels[n]}</span>
            )}
          </label>
        )
      })}
    </div>
  )
}

// --- Password -------------------------------------------------------------

export function PasswordInput({
  value,
  onChange,
  id,
  invalid,
  showMeter = false,
  autoComplete = 'new-password',
  ...props
}: Omit<ComponentPropsWithoutRef<'input'>, 'onChange' | 'value' | 'type'> & {
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  showMeter?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const strength = passwordStrength(value)
  const meterId = useId()

  return (
    <div>
      <div className="relative">
        <input
          {...props}
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={showMeter ? meterId : props['aria-describedby']}
          className={cn(CONTROL, CONTROL_STATE(invalid), 'pr-12')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-field text-muted hover:text-ink"
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
        </button>
      </div>

      {showMeter && (
        <div id={meterId} className="mt-3">
          <div className="flex items-center gap-2">
            <div className="flex h-1.5 flex-1 gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'flex-1 rounded-pill',
                    value && strength.score > i
                      ? strength.score <= 1
                        ? 'bg-danger'
                        : strength.score === 2
                          ? 'bg-warning'
                          : 'bg-success'
                      : 'bg-line',
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-muted" aria-live="polite">
              Password strength: {strength.label}
            </span>
          </div>

          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(value)
              return (
                <li key={rule.id} className="flex items-center gap-1.5 text-xs">
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-full border',
                      met ? 'border-success bg-success text-white' : 'border-line-strong text-transparent',
                    )}
                  >
                    <Check className="size-3" />
                  </span>
                  <span className={met ? 'text-success' : 'text-muted'}>
                    {rule.label}
                    <span className="sr-only">{met ? ' — met' : ' — not met'}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// --- Error summary --------------------------------------------------------

/**
 * Summary of the step's errors, rendered at the top of the form.
 * Focusable so validation failures can move focus here, with links to each field.
 */
export function ErrorSummary({
  errors,
  id = 'error-summary',
  title = 'Please fix the following before continuing',
}: {
  errors: { field: string; message: string }[]
  id?: string
  title?: string
}) {
  if (errors.length === 0) return null
  return (
    <div
      id={id}
      role="alert"
      tabIndex={-1}
      className="rounded-card border border-danger bg-danger-subtle p-4 focus:outline-none"
    >
      <p className="flex items-center gap-2 font-display font-bold uppercase text-danger">
        <AlertCircle aria-hidden className="size-5" />
        {title}
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
        {errors.map((error) => (
          <li key={error.field}>
            <a href={`#${error.field}`} className="text-danger underline underline-offset-2">
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
