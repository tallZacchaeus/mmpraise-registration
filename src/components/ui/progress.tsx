import { cn } from '@/lib/utils'

/**
 * Progress bar (shadcn/ui shape, no Radix).
 *
 * Radix's Progress is a thin wrapper over a div with the same three ARIA
 * attributes set below. Pulling in another package for that would add weight
 * without adding behaviour, so this is hand-rolled and deliberately so.
 *
 * `label` becomes the accessible name. Without one a progressbar is announced
 * as a bare percentage with no indication of what is progressing.
 */
export function Progress({
  value,
  max = 100,
  label,
  className,
  barClassName,
  displayPercent,
}: {
  value: number
  max?: number
  label: string
  className?: string
  barClassName?: string
  /**
   * Visual width override, 0–100.
   *
   * Lets a caller animate the fill without ever moving the ARIA value: a
   * progressbar whose `aria-valuenow` ticked sixty times during an entrance
   * animation would be announced sixty times. The number below stays the truth;
   * only the bar moves.
   */
  displayPercent?: number
}) {
  const clamped = Math.max(0, Math.min(max, value))
  const percent = displayPercent ?? (clamped / max) * 100

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-pill bg-line', className)}
    >
      <div
        className={cn(
          'h-full rounded-pill bg-primary transition-[width,background-color] duration-500 ease-[var(--ease-out-soft)] motion-reduce:transition-none',
          barClassName,
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
