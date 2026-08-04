import { cn } from '@/lib/utils'

/**
 * A rule between sections (shadcn/ui shape, no Radix).
 *
 * Decorative by default and therefore hidden from assistive technology — a
 * screen reader announcing "separator" between every field group is noise. Pass
 * `decorative={false}` only when the rule genuinely conveys a division that the
 * headings do not.
 */
export function Separator({
  className,
  decorative = true,
  orientation = 'horizontal',
}: {
  className?: string
  decorative?: boolean
  orientation?: 'horizontal' | 'vertical'
}) {
  return (
    <div
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'separator', 'aria-orientation': orientation })}
      className={cn(
        'shrink-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    />
  )
}
